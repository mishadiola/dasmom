import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSystemSettings } from '../../context/SystemSettingsContext';
import useClickOutside from '../../hooks/useClickOutside';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Filter,
  AlertTriangle,
  Eye,
  MapPin,
  Calendar,
  HeartPulse,
  ChevronRight,
  ChevronLeft,
  ArrowUpRight,
  AlertCircle,
  Activity,
  Archive,
  ChevronDown,
  FileText,
  Info,
  X
} from 'lucide-react';
import * as XLSX from 'xlsx';
import ExportModal from '../../components/ExportModal';
import Legend from '../../components/Legend/Legend';
import PatientService from '../../services/patientservice';
import PatientStaffAssignment from '../../components/Patient/PatientStaffAssignment';
import '../../styles/components/SharedFilters.css';
import '../../styles/pages/HighRiskCases.css';
import StaffPageLoader from '../../components/Common/StaffPageLoader';
import { formatMotherId } from '../../utils/displayIds';
import { exportStandardStaffPdf } from '../../utils/staffPdfTemplate';
import { useDefaultStation } from '../../hooks/useDefaultStation';

const getCategoryTheme = (category) => {
  const lower = String(category || '').toLowerCase();
  if (lower.includes('pre-existing') || lower.includes('preexisting')) return 'pre-existing';
  if (lower.includes('pregnancy-related') || lower.includes('pregnancy related')) return 'pregnancy-related';
  if (lower.includes('obstetric') || lower.includes('history')) return 'obstetric-history';
  return 'pre-existing';
};

const TrimesterBadge = ({ weeks }) => {
  let trim = 1;
  if (weeks >= 13) trim = 2;
  if (weeks >= 27) trim = 3;

  return (
    <span className={`trim-badge trim-${trim}`}>
      T{trim} &middot; {weeks || '--'}w
    </span>
  );
};

const HighRiskCases = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    totalHighRisk: 0,
    criticalToday: 0,
    missedFollowups: 0,
    needsImmediate: 0,
  });
  const [patients, setPatients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [availableStations, setAvailableStations] = useState([]);
  const [assignmentAccess, setAssignmentAccess] = useState({ role: '', stationId: null });

  const {
    isStationStaff,
    assignedStation,
    canViewOtherStations,
    availableStations: permittedStations,
    matchStation,
  } = useDefaultStation({
    permissionKey: 'patient.view.other_station',
    allStations: availableStations,
    isArray: false,
  });

  const [filterStation, setFilterStation] = useState(() => (
    isStationStaff && assignedStation ? assignedStation : 'All'
  ));
  const userHasChangedStationRef = useRef(false);

  useEffect(() => {
    if (!userHasChangedStationRef.current && isStationStaff && assignedStation) {
      setFilterStation(assignedStation);
    }
  }, [isStationStaff, assignedStation]);

  const [filterType, setFilterType] = useState('All');
  const [filterRiskLevel, setFilterRiskLevel] = useState('All');
  const [filterTrimester, setFilterTrimester] = useState('All');
  const [filterDateRange, setFilterDateRange] = useState('All');

  const hasActiveFilters = filterStation !== 'All' || filterType !== 'All' || filterRiskLevel !== 'All' || filterTrimester !== 'All' || filterDateRange !== 'All' || searchTerm !== '';

  const clearFilters = () => {
      const defStation = (isStationStaff && !canViewOtherStations) ? (assignedStation || '__UNASSIGNED__') : 'All';
      setFilterStation(defStation);
      setFilterType('All');
      setFilterRiskLevel('All');
      setFilterTrimester('All');
      setFilterDateRange('All');
      setSearchTerm('');
      setActivePopover(null);
      setCurrentPage(1);
  };

  const [conditionPopover, setConditionPopover] = useState(null);

  useEffect(() => {
    if (!conditionPopover) return;
    const handleClickOutside = (e) => {
      if (!e.target.closest('.conditions-popover-card') && !e.target.closest('.condition-more-btn')) {
        setConditionPopover(null);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setConditionPopover(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [conditionPopover]);

  const handleOpenConditionPopover = (e, patient) => {
    e.stopPropagation();
    if (conditionPopover && conditionPopover.patient?.id === patient.id) {
      setConditionPopover(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const popoverWidth = 320;
    const popoverEstimatedHeight = 260;
    let top = rect.bottom + 6;
    if (top + popoverEstimatedHeight > window.innerHeight && rect.top - popoverEstimatedHeight > 10) {
      top = rect.top - popoverEstimatedHeight - 6;
    }
    let left = rect.left;
    if (left + popoverWidth > window.innerWidth - 16) {
      left = window.innerWidth - popoverWidth - 16;
    }
    if (left < 16) left = 16;

    setConditionPopover({
      patient,
      top,
      left
    });
  };

  const [activePopover, setActivePopover] = useState(null);
  const filterRowRef = useRef(null);
  useClickOutside(filterRowRef, () => setActivePopover(null));
  const [currentPage, setCurrentPage] = useState(1);
  const { settings } = useSystemSettings();
    const itemsPerPage = settings?.tables?.rowsPerPage || 10;

  const service = useMemo(() => new PatientService(), []);

  useEffect(() => {
    const fetchStations = async () => {
      try {
        const data = await service.getAllStations();
        setAvailableStations(data);
      } catch (err) {
        console.error('Error fetching stations:', err);
      }
    };
    fetchStations();
  }, [service]);

  const hasLoadedOnceRef = useRef(false);

  const loadHighRiskData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent && !hasLoadedOnceRef.current) {
        setLoading(true);
      }
      setError(null);

      const [patientsData, access] = await Promise.all([
        service.getHighRiskPatients(),
        service.getCurrentUserAccess(),
      ]);
      setAssignmentAccess(access);

      const enriched = (patientsData || [])
        .map((p) => ({
          ...p,
          name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Unnamed Patient',
          station: p.station || p.barangay || p.municipality || 'Unassigned',
          condition: p.condition || 'None',
          gravida: p.gravida || 0,
          pregnancyType: p.pregnancyType || 'Singleton',
          weeks: p.weeks || 0,
          pregnancyStatus: p.pregn_postp || 'Pregnant',
        }))
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      const uniquePatients = Array.from(new Map(enriched.map((item) => [item.id, item])).values());
      const patientsWithConditions = uniquePatients.filter((item) => item.hasHealthConditions);

      setStats({
        highRiskCount: patientsWithConditions.length,
        totalWithConditions: patientsWithConditions.length,
        criticalToday: 0,
        missedFollowups: 0,
        needsImmediate: 0,
      });
      setPatients(patientsWithConditions);
      hasLoadedOnceRef.current = true;
    } catch (err) {
      console.error('Error loading high risk data:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [service]);

  useEffect(() => {
    let timeout;
    loadHighRiskData(false);

    const subscription = service.subscribeToHighRiskChanges(() => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        loadHighRiskData(true);
      }, 500);
    });

    return () => {
      if (timeout) clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [loadHighRiskData, service]);

  const filteredPatients = patients.filter((p) => {
    const search = searchTerm.toLowerCase();
    const conditionMatches = (p.activeCategories || []).some(cat => 
      cat.category.toLowerCase().includes(search) ||
      cat.conditions.some(cond => cond.toLowerCase().includes(search))
    ) || (p.documentedConditions || []).some(c => c.toLowerCase().includes(search));

    const matchesSearch =
      (p.name || '').toLowerCase().includes(search) ||
      (p.id || '').toLowerCase().includes(search) ||
      conditionMatches;
    const matchesStation = matchStation(p.station, filterStation);
    const matchesType = filterType === 'All' || (p.type || 'Mother') === filterType;
    
    // Risk Level Filter
    const matchesRiskLevel = filterRiskLevel === 'All' || p.riskLevel === filterRiskLevel;
    
    // Trimester Filter
    let patientTrimester = 1;
    if (p.weeks >= 13) patientTrimester = 2;
    if (p.weeks >= 27) patientTrimester = 3;
    const matchesTrimester = filterTrimester === 'All' || patientTrimester.toString() === filterTrimester;
    
    // Exclude postpartum patients - they should not appear in high risk list
    // as they are now managed through DeliveryOutcomes
    const isPostpartum = p.pregnancyStatus === 'Postpartum' || p.pregnancyStatus === 'postpartum';
    const matchesPostpartum = !isPostpartum;
    
    // Date Range Filter
    const today = new Date();
    let matchesDateRange = filterDateRange === 'All';
    if (filterDateRange !== 'All' && p.nextVisit !== 'Initial') {
      const visitDate = new Date(p.nextVisit);
      const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const startOfTomorrow = new Date(startOfToday);
      startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
      const endOfWeek = new Date(startOfToday);
      endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()));
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      
      if (filterDateRange === 'Today') {
          matchesDateRange = visitDate >= startOfToday && visitDate < startOfTomorrow;
      } else if (filterDateRange === 'This Week') {
          matchesDateRange = visitDate >= startOfToday && visitDate <= endOfWeek;
      } else if (filterDateRange === 'This Month') {
          matchesDateRange = visitDate >= startOfToday && visitDate <= endOfMonth;
      }
    }
    
    return matchesSearch && matchesStation && matchesType && matchesRiskLevel && matchesTrimester && matchesDateRange && matchesPostpartum;
  });

  const totalPages = Math.ceil(filteredPatients.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedPatients = filteredPatients.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  const [showExportModal, setShowExportModal] = useState(false);

  const handleExport = async (exportConfig) => {
    const { format, reportPeriodText } = exportConfig;
    
    const exportData = filteredPatients.map(p => ({
        'Patient ID': formatMotherId(p.id) || '',
        'Name': p.name || '',
        'Station': p.station || 'Unassigned',
        'Age': p.age || 'N/A',
        'Gestation': p.weeks ? `${p.weeks} weeks` : 'N/A',
        'Documented Health Conditions': (p.activeCategories && p.activeCategories.length > 0)
            ? p.activeCategories.map(cat => `${cat.category}: ${cat.conditions.join(', ')}`).join('; ')
            : (p.condition || 'None Reported'),
        'Next Appointment': p.nextVisit || 'Initial'
    }));

    if (format === 'excel') {
        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Health Conditions');
        XLSX.writeFile(workbook, 'health_conditions.xlsx');
    } else if (format === 'pdf') {
        try {
            const tableColumn = ["Patient ID", "Name", "Station", "Age", "Gestation", "Documented Health Conditions", "Next Appt"];
            const tableRows = exportData.map(obj => [
                obj['Patient ID'],
                obj['Name'],
                obj['Station'],
                obj['Age'],
                obj['Gestation'],
                obj['Documented Health Conditions'],
                obj['Next Appointment']
            ]);

            const stationText = filterStation === 'All' ? 'All Stations' : filterStation;
            const periodText = reportPeriodText || (filterDateRange === 'All' ? 'All Dates' : filterDateRange);

            exportStandardStaffPdf({
                orientation: 'landscape',
                title: 'Patients with Health Conditions',
                period: periodText,
                station: stationText,
                totalRecords: exportData.length,
                columns: tableColumn,
                rows: tableRows,
                filename: 'health_conditions.pdf'
            });
        } catch (error) {
            console.error("Error generating PDF:", error);
        }
    }
  };

  const getRowClass = (p) => {
    if (p.hasHealthConditions) return 'row-high-risk';
    return 'row-monitor';
  };

  if (loading)
    return (
      <StaffPageLoader 
        message="Loading health conditions..." 
        error={error} 
        onRetry={loadHighRiskData} 
      />
    );

  return (
    <div className="high-risk-page animate-fade staff-page-ready">
      {/* ── Page Header ── */}
      <div className="page-header">
        <div>
          <div className="page-title-row">
            <h1 className="page-title">
              <AlertTriangle
                size={22}
                style={{
                  verticalAlign: 'middle',
                  marginRight: '8px',
                  color: 'var(--color-rose)',
                }}
              />
              Health Conditions
            </h1>
            <span className="title-statistic-badge">
              Patients with Health Conditions: <strong>{filteredPatients.length}</strong>
            </span>
          </div>
          <p className="page-subtitle">
            Monitor pregnant patients with documented medical conditions, pregnancy-related complications, and relevant obstetric factors.
          </p>
        </div>

        <div className="header-actions">
          <button className="btn btn-outline" onClick={() => setShowExportModal(true)}>
            <FileText size={16} /> Export
          </button>
        </div>
      </div>

      {/* ── Search & Filters ── */}
      <div className="shared-controls-card">
        <div className="shared-search-wrap">
          <Search size={16} className="shared-search-icon" />
          <input
            type="text"
            className="shared-search-input"
            placeholder="Search by name or patient ID..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
        <div className="shared-filters-row" ref={filterRowRef}>
          <span className="filters-label">
            <Filter size={13} /> Filters:
          </span>
          
          
          {/* Station Filter */}
          <div className="filter-dropdown-container">
              <button 
                  className={`filter-btn ${filterStation !== 'All' ? 'active-filter' : ''}`}
                  onClick={() => setActivePopover(activePopover === 'station' ? null : 'station')}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                  <MapPin size={14} className="filter-btn-icon" />
                  <span>{filterStation === 'All' ? 'All Stations' : filterStation}</span>
                  <ChevronDown size={14} className="filter-btn-icon" />
              </button>
              {activePopover === 'station' && (
                  <div className="filter-popover">
                      <div className="popover-title">Station</div>
                      <div className="popover-options">
                          {(!isStationStaff || canViewOtherStations) && (
                              <button className={`popover-opt-btn ${filterStation === 'All' ? 'selected' : ''}`} onClick={() => { userHasChangedStationRef.current = true; setFilterStation('All'); setActivePopover(null); setCurrentPage(1); }}>All Stations</button>
                          )}
                          {permittedStations.map((station) => (
                              <button key={station} className={`popover-opt-btn ${filterStation === station ? 'selected' : ''}`} onClick={() => { userHasChangedStationRef.current = true; setFilterStation(station); setActivePopover(null); setCurrentPage(1); }}>{station}</button>
                          ))}
                      </div>
                  </div>
              )}
          </div>
          
          {/* Trimester Filter */}
          <div className="filter-dropdown-container">
              <button 
                  className={`filter-btn ${filterTrimester !== 'All' ? 'active-filter' : ''}`}
                  onClick={() => setActivePopover(activePopover === 'trimester' ? null : 'trimester')}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                  <Activity size={14} className="filter-btn-icon" />
                  <span>{filterTrimester === 'All' ? 'All Trimesters' : filterTrimester === '1' ? '1st Trimester' : filterTrimester === '2' ? '2nd Trimester' : '3rd Trimester'}</span>
                  <ChevronDown size={14} className="filter-btn-icon" />
              </button>
              {activePopover === 'trimester' && (
                  <div className="filter-popover">
                      <div className="popover-title">Trimester</div>
                      <div className="popover-options">
                          <button className={`popover-opt-btn ${filterTrimester === 'All' ? 'selected' : ''}`} onClick={() => { setFilterTrimester('All'); setActivePopover(null); setCurrentPage(1); }}>All Trimesters</button>
                          <button className={`popover-opt-btn ${filterTrimester === '1' ? 'selected' : ''}`} onClick={() => { setFilterTrimester('1'); setActivePopover(null); setCurrentPage(1); }}>1st Trimester</button>
                          <button className={`popover-opt-btn ${filterTrimester === '2' ? 'selected' : ''}`} onClick={() => { setFilterTrimester('2'); setActivePopover(null); setCurrentPage(1); }}>2nd Trimester</button>
                          <button className={`popover-opt-btn ${filterTrimester === '3' ? 'selected' : ''}`} onClick={() => { setFilterTrimester('3'); setActivePopover(null); setCurrentPage(1); }}>3rd Trimester</button>
                      </div>
                  </div>
              )}
          </div>
          
          {/* Status Filter */}

          
          {hasActiveFilters && (
              <button className="clear-filters-btn" onClick={clearFilters}>Clear All</button>
          )}

          {/* Legend Popover */}
          <Legend 
              categories={[
                  {
                      title: "Health Conditions",
                      items: [
                          { label: "Pre-existing Medical Conditions", className: "category-badge category-badge--pre-existing" },
                          { label: "Pregnancy-Related Conditions", className: "category-badge category-badge--pregnancy-related" },
                          { label: "Relevant Obstetric History", className: "category-badge category-badge--obstetric-history" }
                      ]
                  },
                  {
                      title: "Gestation",
                      items: [
                          { label: "1st Trim", className: "trim-1" },
                          { label: "2nd Trim", className: "trim-2" },
                          { label: "3rd Trim", className: "trim-3" }
                      ]
                  }
              ]}
          />
        </div>

      </div>

      {/* ── Main Layout ── */}
      <div className="hr-main-grid">
        {/* ── Left Column: Table ── */}
        <div className="hr-table-col">
          <div className="hr-card">
            <div className="hr-card-head">
              <h2 style={{ color: 'var(--color-rose, #b9818a)' }}>
                <HeartPulse size={17} /> Health Condition Monitoring
              </h2>
              <span className="hr-count">{filteredPatients.length} patients</span>
            </div>

            <div className="table-responsive">
              <table className="hr-table">
                <thead>
                  <tr>
                    <th className="row-number-header">#</th>
                    <th>Patient Profile</th>
                    <th>Gestation</th>
                    <th>Documented Health Conditions</th>
                    <th>Due Date</th>
                    <th>Next Visit</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedPatients.length > 0 ? (
                    paginatedPatients.map((p, index) => (
                      <tr key={p.id} className={getRowClass(p) + " hr-clickable-row"} onClick={() => navigate(`/dashboard/patients/${p.id}?from=high-risk&tab=history`)}>
                        <td className="row-number-cell">
                          {startIndex + index + 1}
                        </td>
                        <td>
                          <div
                            className="patient-cell"
                            >
                            <div className="patient-avatar">
                              {(p.name || '')
                                .split(' ')
                                .map((n) => n[0])
                                .slice(0, 2)
                                .join('') || 'ID'}
                            </div>
                            <div>
                              <p className="patient-name patient-name-link" style={{ margin: 0 }}>{p.name}</p>
                              <PatientStaffAssignment
                                patientId={p.id}
                                patientStationId={p.stationId}
                                assignedStaffId={p.assignedStaffId}
                                viewerStationId={assignmentAccess.stationId}
                                onAssigned={({ id: assignedStaffId }) => setPatients(previous => previous.map(patient =>
                                  patient.id === p.id ? { ...patient, assignedStaffId } : patient
                                ))}
                              />
                            </div>
                          </div>
                        </td>
                        <td>
                          <TrimesterBadge weeks={p.weeks} />
                        </td>
                        <td>
                          {(!p.activeCategories || p.activeCategories.length === 0) ? (
                            <span 
                              className="risk-badge condition-none"
                              onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/patients/${p.id}?from=high-risk&tab=history`); }}
                              style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
                              title="View Medical History"
                            >
                              None Reported
                            </span>
                          ) : (
                            <div className="patient-conditions-cell" onClick={(e) => e.stopPropagation()}>
                              {p.activeCategories.slice(0, 2).map((catGroup, catIdx) => {
                                const theme = getCategoryTheme(catGroup.category);
                                const allConditions = catGroup.conditions || [];
                                const displayConditions = allConditions.slice(0, 2);
                                const extraConditionsCount = allConditions.length - displayConditions.length;

                                return (
                                  <div key={catIdx} className="category-group">
                                    <span 
                                      className={`category-badge category-badge--${theme}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/dashboard/patients/${p.id}?from=high-risk&tab=history`);
                                      }}
                                      title="View in Medical History"
                                    >
                                      {catGroup.category}
                                    </span>
                                    <div className="category-conditions-text">
                                      {displayConditions.join(', ')}
                                      {extraConditionsCount > 0 && (
                                        <button
                                          type="button"
                                          className="condition-more-btn"
                                          onClick={(e) => handleOpenConditionPopover(e, p)}
                                          title="View all documented conditions"
                                        >
                                          +{extraConditionsCount} more
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}

                              {p.activeCategories.length > 2 && (
                                <button
                                  type="button"
                                  className="condition-more-btn condition-more-btn--categories"
                                  onClick={(e) => handleOpenConditionPopover(e, p)}
                                  title="View all categories & conditions"
                                >
                                  +{p.activeCategories.length - 2} more {p.activeCategories.length - 2 === 1 ? 'category' : 'categories'}
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                        <td>
                          <span className="due-date-val">
                            {p.edd
                              ? new Date(p.edd).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })
                              : 'N/A'}
                          </span>
                        </td>
                        <td>
                          <span>
                            {p.nextVisit || 'Initial'}
                          </span>
                        </td>
                        </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="hr-empty">
                        <AlertTriangle size={28} />
                        <p>No patients with documented health conditions found matching your criteria.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="pagination-wrap">
                <span>
                  Showing {startIndex + 1}–
                  {Math.min(startIndex + itemsPerPage, filteredPatients.length)} of{' '}
                  {filteredPatients.length}
                </span>

                <div className="pagination-controls">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => p - 1)}
                    className="page-btn"
                  >
                    <ChevronLeft size={16} />
                  </button>

                  <div className="page-numbers">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((num) => (
                      <button
                        key={num}
                        className={`page-num ${currentPage === num ? 'active' : ''}`}
                        onClick={() => setCurrentPage(num)}
                      >
                        {num}
                      </button>
                    ))}
                  </div>

                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => p + 1)}
                    className="page-btn"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <ExportModal 
          isOpen={showExportModal} 
          onClose={() => setShowExportModal(false)} 
          onExport={handleExport} 
          hideDateRange={true}
      />

      {conditionPopover && createPortal(
        <div 
          className="conditions-popover-card" 
          style={{
            position: 'fixed',
            top: `${conditionPopover.top}px`,
            left: `${conditionPopover.left}px`,
            zIndex: 9999
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="conditions-popover-header">
            <div>
              <h4 className="conditions-popover-title">Documented Health Conditions</h4>
              <p className="conditions-popover-sub">
                {conditionPopover.patient.name} &middot; {formatMotherId(conditionPopover.patient.id)}
              </p>
            </div>
            <button 
              type="button" 
              className="conditions-popover-close" 
              onClick={() => setConditionPopover(null)}
              aria-label="Close"
            >
              <X size={15} />
            </button>
          </div>

          <div className="conditions-popover-body">
            {(conditionPopover.patient.activeCategories || []).map((catGroup, idx) => {
              const theme = getCategoryTheme(catGroup.category);
              return (
                <div key={idx} className="conditions-popover-group">
                  <span className={`category-badge category-badge--${theme}`}>
                    {catGroup.category}
                  </span>
                  <div className="conditions-popover-tags">
                    {(catGroup.conditions || []).map((c, cIdx) => (
                      <span key={cIdx} className="conditions-popover-tag">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="conditions-popover-footer">
            <button 
              type="button"
              className="conditions-popover-history-link"
              onClick={() => {
                const patientId = conditionPopover.patient.id;
                setConditionPopover(null);
                navigate(`/dashboard/patients/${patientId}?from=high-risk&tab=history`);
              }}
            >
              View Full Medical History &rarr;
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default HighRiskCases;