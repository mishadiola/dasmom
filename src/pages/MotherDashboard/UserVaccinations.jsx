import React, { useState, useEffect } from 'react';
import AuthService from '../../services/authservice';
import PatientService from '../../services/patientservice';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { 
    Syringe, Search, Filter, Calendar, 
    CheckCircle2, Clock, AlertCircle, 
    ChevronRight, Info, Download,
    HeartPulse, Baby, ArrowLeft, UserRound, MapPin
} from 'lucide-react';
import '../../styles/pages/UserVaccinations.css';
import VaccineDetailModal from '../../components/MotherDashboard/VaccineDetailModal';
import { useNavigate } from 'react-router-dom';
import vaccinationsSilhouette from '../../assets/images/vaccinations-silhouette.png';
import { useLanguage } from '../../context/LanguageContext';
import { isNewbornVaccinationEligible } from '../../utils/pregnancyUtils';

const UserVaccinations = () => {
    const navigate = useNavigate();
    const [vaccines, setVaccines] = useState([]);
    const [patientInfo, setPatientInfo] = useState({});
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState('All');
    const [selectedVaccine, setSelectedVaccine] = useState(null);
    const { t } = useLanguage();

    useEffect(() => {
        const load = async () => {
            const auth = new AuthService();
            const ps = new PatientService();
            try {
                const authUser = await auth.getAuthUser();
                if (!authUser?.id) return;
                const patient = await ps.getPatientById(authUser.id);
                
                // Combine mother's vaccines and children's vaccines
                let allVaccines = [];
                
                // Add mother's vaccines
                if (patient?.vaccines) {
                    allVaccines = allVaccines.concat(patient.vaccines.map(v => ({
                        ...v,
                        personType: 'self',
                        personName: 'You'
                    })));
                }
                
                // Add children's vaccines
                if (patient?.newborns && patient.newborns.length > 0) {
                    const pregnancyByDeliveryId = new Map(
                        (patient.pregnancyHistory || []).flatMap(pregnancy =>
                            (pregnancy.deliveries || []).map(delivery => [delivery.id, pregnancy.pregnancyNumber])
                        )
                    );
                    patient.newborns.filter(isNewbornVaccinationEligible).forEach(newborn => {
                        if (newborn.vaccines && newborn.vaccines.length > 0) {
                            allVaccines = allVaccines.concat(newborn.vaccines.map(v => ({
                                ...v,
                                personType: 'child',
                                personName: newborn.baby_name || 'Baby',
                                pregnancyNumber: pregnancyByDeliveryId.get(newborn.delivery_id) || null
                            })));
                        }
                    });
                }
                
                setVaccines(allVaccines);

                const fullName = patient ? [patient.first_name, patient.middle_name, patient.last_name, patient.suffix].filter(Boolean).join(' ') : 'N/A';
                setPatientInfo({
                    name: fullName || 'N/A',
                    id: patient?.patient_id || patient?.id || 'N/A',
                    station: patient?.station || 'N/A'
                });
            } catch (err) {
                console.error('Failed to load vaccines:', err);
            }
        };
        load();
    }, []);
    const filteredVaccines = vaccines.filter(v => {
        // Use notes as vaccine guide display name - this is the primary vaccine identifier
        const displayName = v.notes || v.vaccine_name || v.name || '';
        const matchesSearch = displayName.toLowerCase().includes(searchTerm.toLowerCase());
        // Determine category based on person type: self = Maternal, child = Newborn
        const category = v.personType === 'self' ? 'Maternal' : 'Newborn';
        const matchesFilter = filter === 'All' || category === filter;
        return matchesSearch && matchesFilter;
    });

    const getStatusIcon = (status) => {
        switch (status) {
            case 'Completed': return <CheckCircle2 size={16} />;
            case 'Upcoming': return <Clock size={16} />;
            case 'Missed': return <AlertCircle size={16} />;
            default: return null;
        }
    };

    const completedCount = vaccines.filter(v => (v.status || '').toString().toLowerCase() === 'completed').length;
    const totalCount = vaccines.length;

    const handleDownloadPDF = () => {
        const doc = new jsPDF('portrait');
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 14;
        let y = 16;

        // ── Header ──
        doc.setFontSize(18);
        doc.setTextColor(139, 90, 100);
        doc.text('DASMOM+', margin, y);
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text('City Health Office — Dasmari\u00f1as, Cavite', margin, y + 7);
        y += 16;

        doc.setDrawColor(185, 129, 138);
        doc.setLineWidth(0.5);
        doc.line(margin, y, pageWidth - margin, y);
        y += 10;

        // ── Report Title ──
        doc.setFontSize(16);
        doc.setTextColor(40);
        doc.text('Vaccination Record', margin, y);
        y += 10;

        // ── Patient Info ──
        doc.setFontSize(10);
        doc.setTextColor(80);
        const patientId = String(patientInfo.id || 'N/A').substring(0, 8).toUpperCase();
        doc.text(`Patient Name: ${patientInfo.name || 'N/A'}`, margin, y);
        doc.text(`Patient ID: ${patientId}`, pageWidth / 2, y);
        y += 6;
        doc.text(`Health Station: ${patientInfo.station || 'N/A'}`, margin, y);
        doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, y);
        y += 6;
        doc.text(`Progress: ${completedCount} of ${totalCount} vaccinations completed`, margin, y);
        y += 10;

        doc.setDrawColor(200);
        doc.setLineWidth(0.3);
        doc.line(margin, y, pageWidth - margin, y);
        y += 8;

        // ── Maternal Vaccinations ──
        const maternalVaccines = vaccines.filter(v => v.personType === 'self');
        const newbornVaccines = vaccines.filter(v => v.personType === 'child');

        const buildVaccineRows = (list) => list.map(v => {
            const displayName = v.notes || v.vaccine_name || v.name || 'Vaccine';
            const scheduledDate = v.scheduled_vaccination
                ? new Date(v.scheduled_vaccination).toLocaleDateString('en-PH')
                : '--';
            const administeredDate = v.vaccinated_date
                ? new Date(v.vaccinated_date).toLocaleDateString('en-PH')
                : '--';
            return [
                displayName,
                v.dose_number ? `Dose ${v.dose_number}` : '--',
                v.schedule || 'As advised',
                scheduledDate,
                administeredDate,
                v.status || 'Pending'
            ];
        });

        const tableHead = [['Vaccine', 'Dose', 'Recommended', 'Scheduled', 'Administered', 'Status']];
        const tableStyles = {
            theme: 'grid',
            styles: { fontSize: 8, cellPadding: 3 },
            headStyles: { fillColor: [185, 129, 138], textColor: 255, fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [252, 249, 250] },
            margin: { left: margin, right: margin },
            didDrawPage: (data) => {
                const pageCount = doc.internal.getNumberOfPages();
                doc.setFontSize(8);
                doc.setTextColor(150);
                doc.text(
                    `Page ${data.pageNumber} of ${pageCount}`,
                    pageWidth / 2,
                    doc.internal.pageSize.getHeight() - 10,
                    { align: 'center' }
                );
                doc.text(
                    'DASMOM+ \u2014 Confidential Patient Record',
                    margin,
                    doc.internal.pageSize.getHeight() - 10
                );
            }
        };

        if (maternalVaccines.length > 0) {
            doc.setFontSize(13);
            doc.setTextColor(40);
            doc.text('Maternal Vaccinations', margin, y);
            y += 8;

            doc.autoTable({
                startY: y,
                head: tableHead,
                body: buildVaccineRows(maternalVaccines),
                ...tableStyles,
            });
            y = doc.lastAutoTable.finalY + 12;
        }

        if (newbornVaccines.length > 0) {
            // Group by baby name
            const babyNames = [...new Set(newbornVaccines.map(v => v.personName))];

            babyNames.forEach(babyName => {
                const babyVaccines = newbornVaccines.filter(v => v.personName === babyName);

                // Check if we need a new page
                if (y > doc.internal.pageSize.getHeight() - 50) {
                    doc.addPage();
                    y = 20;
                }

                doc.setFontSize(13);
                doc.setTextColor(40);
                doc.text(`Newborn Vaccinations \u2014 ${babyName}`, margin, y);
                y += 8;

                doc.autoTable({
                    startY: y,
                    head: tableHead,
                    body: buildVaccineRows(babyVaccines),
                    ...tableStyles,
                });
                y = doc.lastAutoTable.finalY + 12;
            });
        }

        if (maternalVaccines.length === 0 && newbornVaccines.length === 0) {
            doc.setFontSize(10);
            doc.setTextColor(120);
            doc.text('No vaccination records available.', margin, y);
        }

        // ── Save ──
        const dateStr = new Date().toISOString().split('T')[0];
        const safeId = String(patientInfo.id || 'UNKNOWN').substring(0, 8).toUpperCase();
        doc.save(`DASMOM_Vaccination_Record_${safeId}_${dateStr}.pdf`);
    };

    return (
        <div className="user-vaccinations-page">
            <div className="page-header hero-header-with-img">
                <img 
                    src={vaccinationsSilhouette} 
                    alt="Vaccinations Silhouette" 
                    className="hero-silhouette-bg" 
                />
                <div className="hero-content-wrapper">
                    <div className="hero-text-section">
                        <h1 className="page-title">
                            <Syringe size={22} className="header-icon" style={{ display: 'inline', marginRight: '6px' }} /> {t('vac_title')}
                        </h1>
                        <p className="page-subtitle">{t('vac_subtitle')}</p>
                        <div className="mother-download-pdf-btn-wrapper">
                            <button className="mother-download-pdf-btn" onClick={handleDownloadPDF} title={t('vac_download')}>
                                <Download size={14} /> Download PDF
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="uv-progress-section">
                <div className="uv-progress-card">
                    <div className="uv-progress-info">
                        <span>{t('vac_progress')}</span>
                        <strong>{t('vac_progress_count').replace('{completed}', completedCount).replace('{total}', totalCount)}</strong>
                    </div>
                    <div className="uv-progress-bar-wrap">
                        <div 
                            className="uv-progress-bar-fill" 
                            style={{ width: totalCount ? `${(completedCount / totalCount) * 100}%` : '0%' }}
                        />
                    </div>
                </div>
            </div>

            <div className="uv-controls">
                <div className="uv-search-bar">
                    <Search size={18} className="search-icon" />
                    <input 
                        type="text" 
                        placeholder={t('vac_search')} 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="uv-filters">
                    {['All', 'Maternal', 'Newborn'].map(f => (
                        <button 
                            key={f}
                            className={`uv-filter-btn ${filter === f ? 'active' : ''}`}
                            onClick={() => setFilter(f)}
                        >
                            {f === 'Maternal' ? <HeartPulse size={14} /> : f === 'Newborn' ? <Baby size={14} /> : null}
                            {f === 'All' ? t('vac_all') : f === 'Maternal' ? t('vac_maternal') : t('vac_newborn')}
                        </button>
                    ))}
                </div>
            </div>

            <div className="uv-cards-grid">
                {filteredVaccines.length > 0 ? (
                    filteredVaccines.map((vaccine, index) => {
                        const status = vaccine.status || 'Unknown';
                        // Determine category based on person type: self = Maternal, child = Newborn
                        const category = vaccine.personType === 'self' ? 'Maternal' : 'Newborn';
                        // NOTES COLUMN IS THE VACCINE NAME - use it as primary display
                        const displayName = vaccine.notes || vaccine.vaccine_name || vaccine.name || 'Vaccine';
                        const desc = vaccine.description || '';
                        const safeId = vaccine.id || `${displayName}-${index}`;
                        return (
                            <div 
                                key={safeId} 
                                className={`uv-vaccine-card status-${String(status).toLowerCase()}`}
                                onClick={() => setSelectedVaccine(vaccine)}
                            >
                                <div className="uv-card-header">
                                    <span className={`uv-category-tag ${String(category).toLowerCase()}`}>
                                        {vaccine.personType === 'self' ? t('vac_my_vaccine') : t('vac_baby_vaccine').replace('{name}', vaccine.personName)}
                                    </span>
                                    <span className={`uv-status-badge status-${String(status).toLowerCase()}`}>
                                        {getStatusIcon(status)} 
                                        {{
                                            'Completed': t('vax_modal_status_completed'),
                                            'Upcoming': t('vax_modal_status_upcoming'),
                                            'Missed': t('vax_modal_status_missed')
                                        }[status] || status}
                                    </span>
                                </div>
                                <h3 className="uv-vaccine-name">Scheduled: {displayName}</h3>
                                {vaccine.vaccine_inventory && (
                                    <p className="uv-vaccine-desc">
                                        Actual Vaccine Given: {vaccine.vaccine_inventory.vaccine_name}
                                        {vaccine.vaccine_inventory.brand ? ` · Brand: ${vaccine.vaccine_inventory.brand}` : ''}
                                    </p>
                                )}
                                {vaccine.personType === 'child' && (
                                    <p className="uv-vaccine-person">
                                        {t('vac_for')} <strong>{vaccine.personName}</strong>
                                        {vaccine.pregnancyNumber && <span> · Pregnancy #{vaccine.pregnancyNumber}</span>}
                                    </p>
                                )}
                                <p className="uv-vaccine-desc">{desc}</p>
                                <div className="uv-vaccine-schedule">
                                    <div className="uv-schedule-item">
                                        <span className="label">{t('vac_recommended')}</span>
                                        <span className="value">{vaccine.schedule || t('vac_as_advised')}</span>
                                    </div>
                                    {vaccine.vaccinated_date && (
                                        <div className="uv-schedule-item">
                                            <span className="label">{t('vac_vaccinated')}</span>
                                            <span className="value">{new Date(vaccine.vaccinated_date).toLocaleDateString('en-PH')}</span>
                                        </div>
                                    )}
                                    {vaccine.scheduled_vaccination && (
                                        <div className="uv-schedule-item">
                                            <span className="label">{t('vac_scheduled')}</span>
                                            <span className="value">{new Date(vaccine.scheduled_vaccination).toLocaleDateString('en-PH')}</span>
                                        </div>
                                    )}
                                </div>
                                {(vaccine.assigned_staff_name || vaccine.assigned_staff_station) && (
                                    <div className="uv-assigned-staff">
                                        {vaccine.assigned_staff_name && <span><UserRound size={14} /> Health worker: <strong>{vaccine.assigned_staff_name}</strong></span>}
                                        {vaccine.assigned_staff_station && <span><MapPin size={14} /> Assigned station: <strong>{vaccine.assigned_staff_station}</strong></span>}
                                    </div>
                                )}
                                <div className="uv-card-footer">
                                    <span>{t('vac_click_details')}</span>
                                    <ChevronRight size={14} />
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="uv-no-results">
                        <Info size={40} />
                        <p>{t('vac_no_results')}</p>
                    </div>
                )}
            </div>

            {selectedVaccine && (
                <VaccineDetailModal 
                    vaccine={selectedVaccine} 
                    onClose={() => setSelectedVaccine(null)} 
                />
            )}
        </div>
    );
};

export default UserVaccinations;
