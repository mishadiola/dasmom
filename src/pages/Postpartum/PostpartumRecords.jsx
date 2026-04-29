import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search, Filter, Baby, Heart, AlertTriangle, Clock,
    CheckCircle2, XCircle, ChevronRight, Eye,
    AlertCircle, FileText, MapPin, Activity, Thermometer,
    Brain, Milk, Calendar, TrendingUp, Download, X
} from 'lucide-react';
import BabyService from '../../services/babyservices';
import * as XLSX from 'xlsx';
import '../../styles/pages/PostpartumRecords.css';

/* ════════════════════════════
   POSTPARTUM DETAIL MODAL
   ════════════════════════════ */
const DetailModal = ({ mother, onClose }) => {
    const babyService = new BabyService();
    const [detail, setDetail] = useState({
        deliveryFacility: 'N/A',
        attendingStaff: 'N/A',
        deliveryComplications: mother.complications || 'None',
        birthWeight: 'N/A',
        breastfeeding: 'N/A',
        mhStatus: 'Normal',
        woundCondition: mother.deliveryType === 'CS' ? 'Pending assessment' : 'N/A (NSD)',
        postpartumVisitDate: null
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDetailData = async () => {
            try {
                setLoading(true);
                // Fetch delivery record with staff info
                const { data: deliveries } = await babyService.supabase
                    .from('deliveries')
                    .select(`
                        id,
                        delivery_date,
                        delivery_type,
                        complications,
                        facility,
                        postpartum_visit_date,
                        staff_profiles!deliveries_attending_staff_fkey (full_name),
                        newborns (birth_weight, condition_at_birth),
                        patient_basic_info (barangay, province)
                    `)
                    .eq('id', mother.id)
                    .single();

                // Fetch postpartum visit schedule from deliveries
                const postpartumVisitDate = deliveries?.postpartum_visit_date || null;

                const updatedDetail = {
                    ...detail,
                    deliveryFacility: deliveries?.patient_basic_info?.barangay || deliveries?.facility || 'N/A',
                    attendingStaff: deliveries?.staff_profiles?.full_name || 'N/A',
                    birthWeight: deliveries?.newborns?.[0]?.birth_weight ? `${deliveries.newborns[0].birth_weight} kg` : 'N/A',
                    deliveryComplications: mother.complications || 'None',
                    woundCondition: mother.deliveryType === 'CS' ? 'Healing Well' : 'N/A (NSD)',
                    postpartumVisitDate: postpartumVisitDate
                };
                setDetail(updatedDetail);
            } catch (error) {
                console.error('Error fetching detail data:', error);
            } finally {
                setLoading(false);
            }
        };

        if (mother?.id) {
            fetchDetailData();
        }
    }, [mother?.id]);

    const followUpStatusClass = (s) => {
        if (s === 'Completed') return 'fu-completed';
        if (s === 'Missed') return 'fu-missed';
        return 'fu-upcoming';
    };

    const followUpIcon = (s) => {
        if (s === 'Completed') return <CheckCircle2 size={14} />;
        if (s === 'Missed') return <XCircle size={14} />;
        return <Clock size={14} />;
    };

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="pp-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div>
                        <h2>{mother.name}</h2>
                        <p>{mother.patientId} · {mother.deliveryType} · Day {mother.daysPostpartum} Postpartum</p>
                    </div>
                    <button className="modal-close" onClick={onClose}><X size={20} /></button>
                </div>

                <div className="modal-body">
                    {/* A. Delivery Summary */}
                    <section className="modal-section">
                        <h3 className="modal-section-title"><Baby size={15} /> Delivery Summary</h3>
                        <div className="detail-grid">
                            <div className="detail-item"><span>Delivery Date</span><strong>{mother.deliveryDate}</strong></div>
                            <div className="detail-item"><span>Facility (Barangay)</span><strong>{detail.deliveryFacility}</strong></div>
                            <div className="detail-item"><span>Delivery Type</span><strong>{mother.deliveryType}</strong></div>
                            <div className="detail-item"><span>Attending Staff</span><strong>{detail.attendingStaff}</strong></div>
                            <div className="detail-item"><span>Complications During Delivery</span><strong>{detail.deliveryComplications}</strong></div>
                            <div className="detail-item"><span>Baby Outcome</span><strong>{mother.babyOutcome}</strong></div>
                        </div>
                    </section>

                    {/* B. Postpartum Visit Schedule */}
                    <section className="modal-section">
                        <h3 className="modal-section-title"><Calendar size={15} /> Postpartum Visit Schedule</h3>
                        <div className="detail-grid">
                            <div className="detail-item"><span>Scheduled Visit Date</span><strong>{detail.postpartumVisitDate || 'Not scheduled'}</strong></div>
                        </div>
                    </section>

                    {/* C. Wound */}
                    <section className="modal-section">
                        <h3 className="modal-section-title"><FileText size={15} /> Wound / Physical Assessment</h3>
                        <div className="detail-grid">
                            <div className="detail-item"><span>Incision / Wound Condition</span><strong>{detail.woundCondition}</strong></div>
                            <div className="detail-item"><span>Current Complications</span><strong>{mother.complications}</strong></div>
                        </div>
                    </section>

                    {/* D. Mental Health */}
                    <section className="modal-section">
                        <h3 className="modal-section-title"><Brain size={15} /> Mental Health Screening</h3>
                        <div className={`mh-status-box ${detail.mhStatus === 'Normal' ? 'mh-normal' : 'mh-alert'}`}>
                            {detail.mhStatus === 'Normal'
                                ? <><CheckCircle2 size={16} /> Screening normal — no signs of postpartum depression</>
                                : <><AlertTriangle size={16} /> Counseling recommended — depression signs observed</>
                            }
                        </div>
                    </section>
                </div>

                <div className="modal-footer">
                    <button className="btn btn-outline" onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
};

/* ════════════════════════════
   MAIN COMPONENT
   ════════════════════════════ */
const PostpartumRecords = () => {
    const navigate = useNavigate();
    const babyService = new BabyService();
    const [stats, setStats] = useState([]);
    const [stationStats, setStationStats] = useState([]);
    const [mothers, setMothers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState({
        deliveryType: 'All', recovery: 'All', station: 'All', followUp: 'All'
    });
    const [selectedMother, setSelectedMother] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const [statData, newRecords] = await Promise.all([
                    babyService.getPostpartumStats(),
                    babyService.getPostpartumRecords()
                ]);
                setStats(statData.summary || []);
                setStationStats(statData.stationRecovery || []);
                setMothers(newRecords || []);
            } catch (error) {
                console.error('Error fetching postpartum data:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const iconMap = {
        Baby,
        Calendar,
        XCircle,
        AlertTriangle,
        CheckCircle2
    };

    const handleFilter = (key, val) => setFilters(prev => ({ ...prev, [key]: val }));

    const handleExportReport = () => {
        const exportData = filtered.map(m => ({
            'Patient Name': m.name,
            'Patient ID': m.patientId,
            'Station': m.station,
            'Delivery Type': m.deliveryType,
            'Delivery Date': m.deliveryDate,
            'Days Postpartum': m.daysPostpartum,
            'Baby Outcome': m.babyOutcome,
            'Recovery Status': m.recoveryStatus,
            'Last Checkup': m.lastCheckup,
            'Next Follow-up': m.nextFollowUp,
            'Follow-up Status': m.followUpStatus,
            'Complications': m.complications,
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Postpartum Records');

        // Auto-size columns
        const colWidths = [
            { wch: 25 }, // Patient Name
            { wch: 15 }, // Patient ID
            { wch: 20 }, // Station
            { wch: 15 }, // Delivery Type
            { wch: 15 }, // Delivery Date
            { wch: 18 }, // Days Postpartum
            { wch: 15 }, // Baby Outcome
            { wch: 15 }, // Recovery Status
            { wch: 15 }, // Last Checkup
            { wch: 15 }, // Next Follow-up
            { wch: 15 }, // Follow-up Status
            { wch: 25 }, // Complications
        ];
        ws['!cols'] = colWidths;

        // Add header styling
        const range = XLSX.utils.decode_range(ws['!ref']);
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cell = ws[XLSX.utils.encode_cell({ r: 0, c: C })];
            if (cell) {
                cell.s = {
                    font: { bold: true, color: { rgb: 'FFFFFF' } },
                    fill: { fgColor: { rgb: 'B9818A' } },
                    alignment: { horizontal: 'center', vertical: 'center' }
                };
            }
        }

        const dateStr = new Date().toISOString().split('T')[0];
        XLSX.writeFile(wb, `Postpartum_Records_${dateStr}.xlsx`);
    };

    const filtered = mothers.filter(m => {
        const s = searchTerm.toLowerCase();
        const matchSearch = m.name.toLowerCase().includes(s) || m.patientId.toLowerCase().includes(s) || m.station.toLowerCase().includes(s);
        const matchDT = filters.deliveryType === 'All' || m.deliveryType === filters.deliveryType;
        const matchRec = filters.recovery === 'All' || m.recoveryStatus === filters.recovery;
        const matchStation = filters.station === 'All' || m.station === filters.station;
        const matchFU = filters.followUp === 'All' || m.followUpStatus === filters.followUp;
        return matchSearch && matchDT && matchRec && matchStation && matchFU;
    });

    const getRecoveryClass = (status) => {
        if (status === 'Normal') return 'tr-normal';
        if (status === 'Monitoring') return 'tr-monitoring';
        return 'tr-complication';
    };

    const getRecoveryBadge = (status) => {
        if (status === 'Normal') return 'badge-normal';
        if (status === 'Monitoring') return 'badge-monitoring';
        return 'badge-complication';
    };

    const getFollowUpBadge = (status) => {
        if (status === 'Completed') return 'fu-badge-completed';
        if (status === 'Missed') return 'fu-badge-missed';
        return 'fu-badge-upcoming';
    };

    return (
        <div className="pp-page">

            {/* ── Page Header ── */}
            <div className="page-header">
                <div>
                    <h1 className="page-title"><Heart size={22} style={{ verticalAlign: 'middle', marginRight: '8px', color: 'var(--color-rose)' }} /> Postpartum Records</h1>
                    <p className="page-subtitle">Monitor mothers post-delivery — recovery, complications & follow-ups</p>
                </div>
                <div className="header-actions">
                    <button className="btn btn-outline" onClick={handleExportReport}><Download size={16} /> Export Report</button>
                </div>
            </div>

            {/* ── Summary Cards ── */}
            <div className="pp-stats-grid">
                {(loading ? [1, 2, 3, 4, 5] : stats).map((s, idx) => {
                    if (loading) return <div key={idx} className="stat-card skeleton-loading" style={{ height: '120px' }} />;
                    const Icon = iconMap[s.icon] || Baby;
                    return (
                        <div key={s.label} className={`stat-card stat-card--${s.color}`}>
                            <div className="stat-top">
                                <div className={`stat-icon stat-icon--${s.color}`}>
                                    <Icon size={20} />
                                </div>
                            </div>
                            <div className="stat-value">{s.value}</div>
                            <div className="stat-label">{s.label}</div>
                        </div>
                    );
                })}
            </div>

            {/* ── Search & Filters ── */}
            <div className="pp-controls-card">
                <div className="pp-search-wrap">
                    <Search size={16} className="pp-search-icon" />
                    <input
                        type="text"
                        className="pp-search-input"
                        placeholder="Search by name, patient ID, or station..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="pp-filters-row">
                    <span className="filters-label"><Filter size={13} /> Filters:</span>
                    <select value={filters.deliveryType} onChange={e => handleFilter('deliveryType', e.target.value)}>
                        <option value="All">All Delivery Types</option>
                        <option value="NSD">NSD (Normal)</option>
                        <option value="CS">CS (Cesarean)</option>
                    </select>
                    <select value={filters.recovery} onChange={e => handleFilter('recovery', e.target.value)}>
                        <option value="All">All Recovery Status</option>
                        <option value="Normal">Normal</option>
                        <option value="Monitoring">Monitoring</option>
                        <option value="Complication">Complication</option>
                    </select>
                    <select value={filters.followUp} onChange={e => handleFilter('followUp', e.target.value)}>
                        <option value="All">All Follow-up Status</option>
                        <option value="Completed">Completed</option>
                        <option value="Upcoming">Upcoming</option>
                        <option value="Missed">Missed</option>
                    </select>
                    <select value={filters.station} onChange={e => handleFilter('station', e.target.value)}>
                        <option value="All">All Stations</option>
                        {[...new Set(mothers.map(m => m.station))].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
            </div>

            {/* ── Main 2-col layout ── */}
            <div className="pp-main-layout">

                {/* ── LEFT: Mothers Table ── */}
                <div className="pp-table-col">
                    <div className="pp-card">
                        <div className="pp-card-head">
                            <h2><Baby size={17} /> Postpartum Mothers</h2>
                            <span className="pp-count">{filtered.length} records</span>
                        </div>
                        <div className="table-responsive">
                            <table className="pp-table">
                                <thead>
                                    <tr>
                                        <th>Patient</th>
                                        <th>Delivery</th>
                                        <th>Days PP</th>
                                        <th>Baby</th>
                                        <th>Recovery</th>
                                        <th>Last Checkup</th>
                                        <th>Next Follow-up</th>
                                        <th>Complications</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map(m => (
                                        <tr key={m.id} className={getRecoveryClass(m.recoveryStatus)}>
                                            <td>
                                                <div className="pp-patient-cell" onClick={() => navigate(`/dashboard/patients/${m.patientId}`)} style={{ cursor: 'pointer' }}>
                                                    <div className="pp-avatar">{m.name.split(' ').map(n => n[0]).slice(0, 2).join('')}</div>
                                                    <div>
                                                        <span className="pp-name patient-name-link">{m.name}</span>
                                                        <span className="pp-meta">{m.patientId} · {m.station}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`dt-badge dt-${m.deliveryType.toLowerCase()}`}>{m.deliveryType}</span>
                                                <div className="pp-ddate">{m.deliveryDate}</div>
                                            </td>
                                            <td className="pp-days-pp">
                                                <span className="days-pill">Day {m.daysPostpartum}</span>
                                            </td>
                                            <td>
                                                <span className={`baby-badge ${m.babyOutcome === 'NICU' ? 'baby-nicu' : 'baby-alive'}`}>{m.babyOutcome}</span>
                                            </td>
                                            <td>
                                                <span className={`recovery-badge ${getRecoveryBadge(m.recoveryStatus)}`}>{m.recoveryStatus}</span>
                                            </td>
                                            <td className="pp-date-cell">{m.lastCheckup}</td>
                                            <td>
                                                <div className="pp-date-cell">{m.nextFollowUp}</div>
                                                <span className={`fu-badge ${getFollowUpBadge(m.followUpStatus)}`}>{m.followUpStatus}</span>
                                            </td>
                                            <td>
                                                <span className={`complication-text ${m.complications !== 'None' ? 'has-complication' : ''}`}>
                                                    {m.complications !== 'None' && <AlertCircle size={12} />}  {m.complications}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="pp-actions">
                                                    <button className="action-btn view-btn" title="View Profile" onClick={() => setSelectedMother(m)}>
                                                        <Eye size={15} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {filtered.length === 0 && (
                                        <tr>
                                            <td colSpan="8" className="pp-empty">
                                                <Baby size={28} />
                                                <p>No postpartum records matching your filters.</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* ── RIGHT: Alerts + Station ── */}
                <div className="pp-side-col">

                    {/* Alerts Panel */}
                    <div className="pp-card">
                        <div className="pp-card-head">
                            <h2><AlertTriangle size={17} /> System Alerts</h2>
                        </div>
                        <div className="alerts-list">
                            {filtered.filter(m => m.recoveryStatus === 'Complication').map(m => (
                                <div key={m.id} className="alert-item alert-critical">
                                    <div className="alert-dot"></div>
                                    <div className="alert-body">
                                        <p>{m.name} has complications: {m.complications}</p>
                                        <span>Patient ID: {m.patientId}</span>
                                    </div>
                                </div>
                            ))}
                            {filtered.filter(m => m.followUpStatus === 'Missed').map(m => (
                                <div key={m.id} className="alert-item alert-warning">
                                    <div className="alert-dot"></div>
                                    <div className="alert-body">
                                        <p>{m.name} missed follow-up on {m.nextFollowUp}</p>
                                        <span>Station: {m.station}</span>
                                    </div>
                                </div>
                            ))}
                            {filtered.filter(m => m.recoveryStatus === 'Complication' || m.followUpStatus === 'Missed').length === 0 && (
                                <p className="pp-empty-side">No urgent alerts found.</p>
                            )}
                        </div>
                    </div>

                    {/* Station Recovery Distribution */}
                    <div className="pp-card">
                        <div className="pp-card-head">
                            <h2><MapPin size={17} /> Station Recovery</h2>
                        </div>
                        <div className="station-list">
                            {stationStats.map(b => {
                                const pct = Math.round((b.recovered / b.total) * 100) || 0;
                                return (
                                    <div key={b.name} className="station-row">
                                        <div className="station-name-row">
                                            <span className="station-name">{b.name}</span>
                                            <span className="station-count">{b.recovered}/{b.total} recovered</span>
                                        </div>
                                        <div className="station-bar-bg">
                                            <div className="station-bar-fill" style={{ width: `${pct}%`, background: pct >= 70 ? '#6db8a0' : pct >= 50 ? '#e8b84b' : '#e05c73' }}></div>
                                        </div>
                                    </div>
                                );
                            })}
                            {stationStats.length === 0 && <p className="pp-empty-side">No station data available.</p>}
                        </div>
                    </div>

                </div>
            </div>

            {/* ── Detail Modal ── */}
            {selectedMother && <DetailModal mother={selectedMother} onClose={() => setSelectedMother(null)} />}

        </div>
    );
};

export default PostpartumRecords;
