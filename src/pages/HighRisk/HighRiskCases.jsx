import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  Info
} from 'lucide-react';
import * as XLSX from 'xlsx';
import ExportModal from '../../components/ExportModal';
import Legend from '../../components/Legend/Legend';
import PatientService from '../../services/patientservice';
import PatientStaffAssignment from '../../components/Patient/PatientStaffAssignment';
import '../../styles/components/SharedFilters.css';
import '../../styles/pages/HighRiskCases.css';

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
  const [stats, setStats] = useState({
    totalHighRisk: 0,
    criticalToday: 0,
    missedFollowups: 0,
    needsImmediate: 0,
  });
  const [patients, setPatients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStation, setFilterStation] = useState('All');
  const [filterType, setFilterType] = useState('All');
  const [filterRiskLevel, setFilterRiskLevel] = useState('All');
  const [filterTrimester, setFilterTrimester] = useState('All');
  const [filterDateRange, setFilterDateRange] = useState('All');
  const [filterAssignment, setFilterAssignment] = useState('All');
  const [availableStations, setAvailableStations] = useState([]);
  const [assignmentAccess, setAssignmentAccess] = useState({ role: '', stationId: null });

  const hasActiveFilters = filterStation !== 'All' || filterType !== 'All' || filterRiskLevel !== 'All' || filterTrimester !== 'All' || filterDateRange !== 'All' || filterAssignment !== 'All' || searchTerm !== '';

  const clearFilters = () => {
      setFilterStation('All');
      setFilterType('All');
      setFilterRiskLevel('All');
      setFilterTrimester('All');
      setFilterDateRange('All');
      setFilterAssignment('All');
      setSearchTerm('');
      setActivePopover(null);
      setCurrentPage(1);
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

  const loadHighRiskData = useCallback(async () => {
    try {
      setLoading(true);

      const [statsData, patientsData, access] = await Promise.all([
        service.getHighRiskStats(),
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
      const highRiskOnly = uniquePatients.filter((item) => item.riskLevel === 'High Risk');

      setStats({
        ...statsData,
        totalHighRisk: highRiskOnly.length,
        criticalToday: 0,
        missedFollowups: 0,
        needsImmediate: 0,
      });
      setPatients(highRiskOnly);
      console.log('Loaded high‑risk:', highRiskOnly.length, 'patients');
    } catch (err) {
      console.error('Error loading high risk data:', err);
    } finally {
      setLoading(false);
    }
  }, [service]);

  useEffect(() => {
    let timeout;
    loadHighRiskData();

    const subscription = service.subscribeToHighRiskChanges(() => {
      console.log('High risk changes detected, re‑fetching...');
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        console.log('Debounced reload...');
        loadHighRiskData();
      }, 500);
    });

    return () => {
      if (timeout) clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [loadHighRiskData]);

  const filteredPatients = patients.filter((p) => {
    const search = searchTerm.toLowerCase();
    const matchesSearch =
      (p.name || '').toLowerCase().includes(search) ||
      (p.id || '').toLowerCase().includes(search);
    const matchesStation = filterStation === 'All' || p.station === filterStation;
    const matchesAssignment = filterAssignment === 'All'
      || (filterAssignment === 'Unassigned' ? !p.assignedStaffId : Boolean(p.assignedStaffId));
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
    
    return matchesSearch && matchesStation && matchesAssignment && matchesType && matchesRiskLevel && matchesTrimester && matchesDateRange && matchesPostpartum;
  });

  const totalPages = Math.ceil(filteredPatients.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedPatients = filteredPatients.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  const getStationDistribution = () => {
    const counts = {};
    filteredPatients.forEach((p) => {
      if (p.station && p.station !== 'Unassigned') {
        counts[p.station] = (counts[p.station] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  };

  const stationDistribution = getStationDistribution();
  const totalAssignedCases = stationDistribution.reduce((sum, item) => sum + item.count, 0);

  const [showExportModal, setShowExportModal] = useState(false);

  const handleExport = async (exportConfig) => {
    const { format } = exportConfig;
    
    const exportData = filteredPatients.map(p => ({
        'Patient ID': p.id || '',
        'Name': p.name || '',
        'Station': p.station || 'Unassigned',
        'Age': p.age || 'N/A',
        'Gestation': p.weeks ? `${p.weeks} weeks` : 'N/A',
        'Risk Level': p.riskLevel || 'High Risk',
        'Conditions': p.condition || '',
        'Next Appointment': p.nextVisit || 'Initial'
    }));

    if (format === 'excel') {
        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'High Risk Cases');
        XLSX.writeFile(workbook, 'high_risk_cases.xlsx');
    } else if (format === 'pdf') {
        try {
            const jsPDF = (await import('jspdf')).default;
            const autoTable = (await import('jspdf-autotable')).default;
            
            const doc = new jsPDF('landscape');
            
            const tableColumn = ["Patient ID", "Name", "Station", "Age", "Gestation", "Risk Level", "Conditions", "Next Appt"];
            const tableRows = exportData.map(obj => [
                obj['Patient ID'],
                obj['Name'],
                obj['Station'],
                obj['Age'],
                obj['Gestation'],
                obj['Risk Level'],
                obj['Conditions'],
                obj['Next Appointment']
            ]);

            doc.text("High Risk Cases List", 14, 15);
            
            autoTable(doc, {
                head: [tableColumn],
                body: tableRows,
                startY: 20,
                styles: { fontSize: 8 },
                headStyles: { fillColor: [147, 111, 199] }
            });

            doc.save("high_risk_cases.pdf");
        } catch (error) {
            console.error("Error generating PDF:", error);
        }
    }
  };

  const getRowClass = (p) => {
    if (p.riskLevel === 'High Risk') return 'row-high-risk';
    if (p.riskLevel === 'Medium Risk') return 'row-moderate-risk';
    return 'row-monitor';
  };

  if (loading)
    return (
      <div className="high-risk-page">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading high‑risk dashboard...</p>
        </div>
      </div>
    );

  return (
    <div className="high-risk-page animate-fade">
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
              High Risk Cases
            </h1>
            <span className="title-statistic-badge">
              Total High-Risk Cases: <strong>{stats.totalHighRisk}</strong>
            </span>
          </div>
          <p className="page-subtitle">
            Monitor pregnant patients with high-risk conditions and complications.
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
          <label className="patient-assignment-filter">
            <span>Health worker</span>
            <select
              value={filterAssignment}
              onChange={event => { setFilterAssignment(event.target.value); setCurrentPage(1); }}
              aria-label="Filter by health worker assignment"
            >
              <option value="All">All</option>
              <option value="Unassigned">Unassigned</option>
              <option value="Assigned">Assigned</option>
            </select>
          </label>
          
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
                          <button className={`popover-opt-btn ${filterStation === 'All' ? 'selected' : ''}`} onClick={() => { setFilterStation('All'); setActivePopover(null); setCurrentPage(1); }}>All Stations</button>
                          {availableStations.map((station) => (
                              <button key={station} className={`popover-opt-btn ${filterStation === station ? 'selected' : ''}`} onClick={() => { setFilterStation(station); setActivePopover(null); setCurrentPage(1); }}>{station}</button>
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
              <h2 style={{ color: '#dc2626' }}>
                <AlertTriangle size={17} /> High‑Risk Monitoring
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
                    <th>Conditions / Complications</th>
                    <th>Due Date</th>
                    <th>BP</th>
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
                                role={assignmentAccess.role}
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
                          <div className="condition-wrap">
                            <span className="condition-main">{p.condition}</span>
                            <span className="condition-meta">
                              {p.isMultipleBirth && <span style={{display: 'block', marginTop: '4px'}}>Multiple births</span>}
                            </span>
                          </div>
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
                          <span
                            className={
                              p.riskLevel === 'High Risk' ? 'text-critical font-bold' : ''
                            }
                          >
                            {p.bp || 'No Data'}
                          </span>
                        </td>
                        <td>
                          <span
                            className={
                              p.riskLevel === 'High Risk' ? 'text-critical font-bold' : ''
                            }
                          >
                            {p.nextVisit || 'Initial'}
                          </span>
                        </td>
                        </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="hr-empty">
                        <AlertTriangle size={28} />
                        <p>No high‑risk patients found matching your criteria.</p>
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

        {/* ── Right Column: Panels ── */}
        <div className="hr-side-col">
          {/* Station Distribution */}
          <div className="hr-card">
            <div className="hr-card-head">
              <h2>
                <MapPin size={16} /> Station Distribution
              </h2>
            </div>
            <div className="station-dist-list">
              {stationDistribution.map((b) => {
                const percentage = totalAssignedCases > 0 ? ((b.count / totalAssignedCases) * 100).toFixed(1) : 0;
                return (
                  <div key={b.name} className="station-dist-item">
                    <span>{b.name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div className="station-bar-wrap">
                        <div
                          className="station-bar-fill"
                          style={{
                            width: `${percentage}%`,
                          }}
                        ></div>
                      </div>
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: 700,
                          color: 'var(--color-rose)',
                          minWidth: '45px',
                          textAlign: 'right',
                        }}
                      >
                        {percentage}%
                      </span>
                    </div>
                  </div>
                );
              })}
              {stationDistribution.length === 0 && (
                <p className="empty-alerts">No records found.</p>
              )}
            </div>
          </div>
        </div>
      </div>
      <ExportModal 
          isOpen={showExportModal} 
          onClose={() => setShowExportModal(false)} 
          onExport={handleExport} 
          hideDateRange={true}
      />
    </div>
  );
};

export default HighRiskCases;