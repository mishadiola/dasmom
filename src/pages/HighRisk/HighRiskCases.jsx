import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Filter,
  AlertTriangle,
  Eye,
  FileText,
  MapPin,
  Calendar,
  HeartPulse,
  ChevronRight,
  ChevronLeft,
  ArrowUpRight,
  AlertCircle,
  Activity,
} from 'lucide-react';
import PatientService from '../../services/patientservice';
import '../../styles/pages/HighRiskCases.css';

const TrimesterBadge = ({ weeks }) => {
  let trim = 1;
  if (weeks >= 13) trim = 2;
  if (weeks >= 27) trim = 3;

  return (
    <span className={`trim-badge trim-${trim}`}>
      {trim}
      {trim === 1 ? 'st' : trim === 2 ? 'nd' : 'rd'} Trim
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
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const service = useMemo(() => new PatientService(), []);

  const loadHighRiskData = useCallback(async () => {
    try {
      setLoading(true);

      const [statsData, patientsData] = await Promise.all([
        service.getHighRiskStats(),
        service.getHighRiskPatients(),
      ]);

      const enriched = await Promise.all(
        (patientsData || []).map(async (p) => {
          const preg = p.pregnancy_info || {};
          const lmp = preg.lmd; // or lmp
          const weeks = service.calculateWeeks(lmp);

          // 1. BP: get LAST ATTENDED visit (current row with BP)
          const { data: lastAttended } = await service.supabase
            .from('prenatal_visits')
            .select('bp_systolic, bp_diastolic, visit_date, status')
            .eq('patient_id', p.id)
            .eq('status', 'Attended')
            .order('visit_date', { ascending: false })
            .limit(1)
            .maybeSingle();

          const bp = lastAttended?.bp_systolic && lastAttended?.bp_diastolic
            ? `${lastAttended.bp_systolic}/${lastAttended.bp_diastolic}`
            : null;

          // 2. EDD from pregnancy_info
          const eddFromPregnancy = preg.edd || null;

          // 3. NEXT APPOINTMENT: use next_appt_date / next_appt_type from the same row
          const today = new Date().toISOString().split('T')[0];
          const { data: nextVisitRow } = await service.supabase
            .from('prenatal_visits')
            .select('next_appt_date, next_appt_type, status, visit_date')
            .eq('patient_id', p.id)
            .not('next_appt_date', 'is', null)
            .gte('next_appt_date', today)
            .order('next_appt_date', { ascending: true })
            .limit(1)
            .maybeSingle();

          const nextApptDate = nextVisitRow?.next_appt_date || null;
          const nextApptType = nextVisitRow?.next_appt_type || 'Follow‑up Checkup';

          // 🔥 Debug: verify BP comes from last attended, and next_appt is future
          console.log(
            '[BP + NEXT DEBUG] Patient:',
            p.name,
            '| id:',
            p.id,
            '| lastAttended:',
            lastAttended,
            '| bp:',
            bp,
            '| nextVisitRow:',
            nextVisitRow
          );

          return {
            id: p.id,
            name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Unnamed Patient',
            first_name: p.first_name,
            last_name: p.last_name,
            station: p.barangay || p.municipality || 'Unassigned',
            riskLevel: preg.calculated_risk || 'High Risk',
            condition: preg.risk_factors || 'High‑risk pregnancy',
            gravida: preg.gravida || 0,
            lmd: lmp || '',
            edd: eddFromPregnancy,
            bp, // 👈 from last attended visit (current row with BP)
            nextVisit: nextApptDate
              ? new Date(nextApptDate).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : 'Initial Visit',
            nextApptType,
            weeks,
          };
        })
      );

      setStats({
        ...statsData,
        totalHighRisk: statsData.highRiskCount || 0,
        criticalToday: 0,
        missedFollowups: 0,
        needsImmediate: 0,
      });
      setPatients(enriched);
      console.log('✅ Loaded high‑risk:', enriched.length, 'patients');
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
      console.log('🔄 High risk changes detected, re‑fetching...');
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        console.log('⏳ Debounced reload...');
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
    return matchesSearch && matchesStation;
  });

  const totalPages = Math.ceil(filteredPatients.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedPatients = filteredPatients.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  const getStationDistribution = () => {
    const counts = {};
    patients.forEach((p) => {
      counts[p.station] = (counts[p.station] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  };

  const stationDistribution = getStationDistribution();

  const getRowClass = (p) => {
    if (p.riskLevel === 'High Risk') return 'row-high-risk';
    if (p.riskLevel === 'Moderate Risk') return 'row-moderate-risk';
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
          <p className="page-subtitle">
            Dynamic monitoring of critical pregnancies and priority follow‑ups
          </p>
        </div>

        {/* ── Header KPI ── */}
        <div className="header-kpi-card">
          <div className="kpi-icon-wrap">
            <AlertTriangle size={20} />
          </div>
          <div>
            <span className="kpi-label">Total High‑Risk Cases</span>
            <div className="kpi-value">{stats.totalHighRisk}</div>
          </div>
        </div>
      </div>

      {/* ── Search & Filters ── */}
      <div className="hr-controls-card">
        <div className="hr-search-wrap">
          <Search size={16} className="hr-search-icon" />
          <input
            type="text"
            className="hr-search-input"
            placeholder="Search by name or patient ID..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
        <div className="hr-filters-row">
          <span className="filters-label">
            <Filter size={13} /> Filters:
          </span>
          <select
            value={filterStation}
            onChange={(e) => {
              setFilterStation(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="All">All Stations</option>
            {stationDistribution.map((b) => (
              <option key={b.name} value={b.name}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Main Layout ── */}
      <div className="hr-main-grid">
        {/* ── Left Column: Table ── */}
        <div className="hr-table-col">
          <div className="hr-card">
            <div className="hr-card-head">
              <h2>
                <HeartPulse size={17} /> Real‑Time High‑Risk Monitoring
              </h2>
              <div className="hr-legend">
                <span className="legend-chip chip-high">
                  <AlertCircle size={11} /> High Risk
                </span>
                <span className="legend-chip chip-monitor">
                  <AlertTriangle size={11} /> Monitor
                </span>
                <span className="legend-chip chip-normal">
                  <Activity size={11} /> Stable
                </span>
              </div>
              <span className="hr-count">{filteredPatients.length} patients</span>
            </div>

            <div className="table-responsive">
              <table className="hr-table">
                <thead>
                  <tr>
                    <th>Patient Profile</th>
                    <th>Stage</th>
                    <th>Conditions / Complications</th>
                    <th>Due Date</th>
                    <th>BP</th>
                    <th>Next Visit</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedPatients.length > 0 ? (
                    paginatedPatients.map((p) => (
                      <tr key={p.id} className={getRowClass(p)}>
                        <td>
                          <div
                            className="patient-cell"
                            onClick={() => navigate(`/dashboard/patients/${p.id}`)}
                            style={{ cursor: 'pointer' }}
                          >
                            <div className="patient-avatar">
                              {(p.name || '')
                                .split(' ')
                                .map((n) => n[0])
                                .slice(0, 2)
                                .join('') || 'ID'}
                            </div>
                            <div>
                              <p className="patient-name patient-name-link">{p.name}</p>
                              <span
                                className={`risk-pill risk-pill-${
                                  (p.riskLevel || '').toLowerCase().split(' ')[0]
                                }`}
                              >
                                {p.riskLevel}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <TrimesterBadge weeks={p.weeks} />
                        </td>
                        <td>
                          <div className="condition-wrap">
                            <span className="condition-main">{p.condition}</span>
                            <span className="condition-meta">{p.riskLevel}</span>
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
                        <td>
                          <div className="action-buttons">
                            <button
                              className="action-btn view-btn"
                              title="View Profile"
                              onClick={() => navigate(`/dashboard/patients/${p.id}`)}
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              className="action-btn record-btn"
                              title={`Record ${p.nextApptType || 'Visit'}`}
                              onClick={() => {
                                navigate(
                                  `/dashboard/patients/${p.id}?tab=visits&view=record&date=${p.nextVisit}`
                                );
                              }}
                            >
                              <FileText size={14} />
                            </button>
                          </div>
                          <small
                            style={{
                              fontSize: '11px',
                              opacity: 0.85,
                              display: 'block',
                              marginTop: '2px',
                            }}
                          >
                            {p.nextApptType}
                          </small>
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
          {/* Alerts Panel */}
          <div className="hr-card">
            <div className="hr-card-head">
              <h2>
                <AlertTriangle size={16} /> Critical Alerts
              </h2>
            </div>
            <div className="alerts-list">
              {filteredPatients
                .filter((p) => (p.riskLevel || '').toLowerCase().includes('high'))
                .slice(0, 8)
                .map((p) => (
                  <div
                    key={p.id}
                    className="alert-item alert-critical"
                    onClick={() => navigate(`/dashboard/patients/${p.id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="alert-dot"></div>
                    <div className="alert-body">
                      <p>
                        <strong>{p.name}</strong>
                      </p>
                      <p className="alert-reason">{p.condition}</p>
                      <div className="alert-footer">
                        <span>Station: {p.station}</span>
                        <ArrowUpRight size={12} />
                      </div>
                    </div>
                  </div>
                ))}
              {filteredPatients.filter((p) =>
                (p.riskLevel || '').toLowerCase().includes('high')
              ).length === 0 && (
                <p className="empty-alerts">No urgent alerts at this time.</p>
              )}
            </div>
          </div>

          {/* Station Distribution */}
          <div className="hr-card">
            <div className="hr-card-head">
              <h2>
                <MapPin size={16} /> Station Distribution
              </h2>
            </div>
            <div className="station-dist-list">
              {stationDistribution.map((b) => (
                <div key={b.name} className="station-dist-item">
                  <span>{b.name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div className="station-bar-wrap">
                      <div
                        className="station-bar-fill"
                        style={{
                          width: `${(b.count / Math.max(patients.length, 1)) * 100}%`,
                        }}
                      ></div>
                    </div>
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 700,
                        color: 'var(--color-rose)',
                        minWidth: '20px',
                        textAlign: 'right',
                      }}
                    >
                      {b.count}
                    </span>
                  </div>
                </div>
              ))}
              {stationDistribution.length === 0 && (
                <p className="empty-alerts">No records found.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HighRiskCases;