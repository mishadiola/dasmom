import React, { useState, useEffect, useRef } from 'react';
import AuthService from '../../services/authservice';
import PatientService from '../../services/patientservice';
import { 
    Syringe, Search, Filter, Calendar, 
    CheckCircle2, Clock, AlertCircle, 
    ChevronRight, Info,
    HeartPulse, Baby, ArrowLeft, UserRound, MapPin
} from 'lucide-react';
import '../../styles/pages/UserVaccinations.css';
import VaccineDetailModal from '../../components/MotherDashboard/VaccineDetailModal';
import { useNavigate } from 'react-router-dom';
import vaccinationsSilhouette from '../../assets/images/vaccinations-silhouette.png';
import { useLanguage } from '../../context/LanguageContext';
import { isNewbornVaccinationEligible } from '../../utils/pregnancyUtils';
import StaffPageLoader from '../../components/Common/StaffPageLoader';

const isUUID = (val) => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim());

const UserVaccinations = () => {
    const navigate = useNavigate();
    const [vaccines, setVaccines] = useState([]);
    const [patientInfo, setPatientInfo] = useState({});
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState('All');
    const [selectedVaccine, setSelectedVaccine] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const loadRef = useRef(null);
    const { t } = useLanguage();

    useEffect(() => {
        const load = async () => {
            const auth = new AuthService();
            const ps = new PatientService();
            try {
                const authUser = await auth.getAuthUser();
                if (!authUser?.id) return;
                const patient = await ps.getPatientById(authUser.id);
                
                const fullName = patient ? [patient.first_name, patient.middle_name, patient.last_name, patient.suffix].filter(Boolean).join(' ') : 'N/A';

                let allVaccines = [];
                const eligibleNewborns = (patient?.newborns || []).filter(isNewbornVaccinationEligible);
                const pregnancyByDeliveryId = new Map(
                    (patient?.pregnancyHistory || []).flatMap(pregnancy =>
                        (pregnancy.deliveries || []).map(delivery => [delivery.id, pregnancy.pregnancyNumber])
                    )
                );
                
                // Add mother's vaccines (from patient.vaccines where recipient_type === 'Mother' or not a newborn)
                const motherVaccines = (patient?.vaccines || [])
                    .filter(v => v.recipient_type === 'Mother' || (!v.newborn_id && Boolean(v.patient_id)))
                    .map(v => ({
                        ...v,
                        personType: 'self',
                        recipient_type: 'Mother',
                        category: 'Mother',
                        personName: fullName !== 'N/A' ? fullName : 'Mother'
                    }));
                allVaccines = allVaccines.concat(motherVaccines);

                // Add children's vaccines
                if (eligibleNewborns.length > 0) {
                    eligibleNewborns.forEach(newborn => {
                        if (newborn.vaccines && newborn.vaccines.length > 0) {
                            allVaccines = allVaccines.concat(newborn.vaccines.map(v => ({
                                ...v,
                                personType: 'child',
                                recipient_type: 'Baby',
                                category: 'Newborn',
                                personName: newborn.baby_name || 'Baby',
                                pregnancyNumber: pregnancyByDeliveryId.get(newborn.delivery_id) || null
                            })));
                        }
                    });
                }

                const supplements = (patient?.supplements || []).map(supplement => {
                    const notes = String(supplement.notes || '');
                    const newborn = eligibleNewborns.find(child => {
                        if (!child.baby_name) return false;
                        const childNotePrefix = `Administered to newborn: ${child.baby_name}`;
                        return notes === childNotePrefix || notes.startsWith(`${childNotePrefix} -`);
                    });

                    return {
                        ...supplement,
                        itemType: 'supplement',
                        personType: newborn ? 'child' : 'self',
                        recipient_type: newborn ? 'Baby' : 'Mother',
                        category: newborn ? 'Newborn' : 'Mother',
                        personName: newborn?.baby_name || fullName || 'Mother',
                        pregnancyNumber: newborn
                            ? pregnancyByDeliveryId.get(newborn.delivery_id) || null
                            : null
                    };
                });
                allVaccines = allVaccines.concat(supplements);

                allVaccines.sort((left, right) => {
                    const leftDate = left.scheduled_vaccination || left.start_date || left.vaccinated_date || left.created_at || '';
                    const rightDate = right.scheduled_vaccination || right.start_date || right.vaccinated_date || right.created_at || '';
                    return leftDate.localeCompare(rightDate);
                });
                
                setVaccines(allVaccines);

                setPatientInfo({
                    name: fullName || 'N/A',
                    id: patient?.patient_id || patient?.id || 'N/A',
                    station: patient?.station || 'N/A'
                });
            } catch (err) {
                console.error('Failed to load vaccines:', err);
                setError(err?.message || 'Unable to load vaccines and supplements.');
            } finally {
                setLoading(false);
            }
        };
        loadRef.current = load;
        load();
        window.addEventListener('online', load);
        return () => window.removeEventListener('online', load);
    }, []);

    const isMotherVaccine = (v) =>
        v.recipient_type === 'Mother' || v.personType === 'self' || (!v.newborn_id && Boolean(v.patient_id));

    const filteredVaccines = vaccines.filter(v => {
        // Use notes as vaccine guide display name - this is the primary vaccine identifier
        const displayName = v.itemType === 'supplement'
            ? v.supplement_name || v.name || ''
            : v.notes || v.vaccine_name || v.name || '';
        const matchesSearch = displayName.toLowerCase().includes(searchTerm.toLowerCase());
        const isMother = isMotherVaccine(v);
        
        let matchesFilter = true;
        if (filter === 'Mother') {
            matchesFilter = isMother;
        } else if (filter === 'Newborn') {
            matchesFilter = !isMother;
        }
        return matchesSearch && matchesFilter;
    });

    const getStatusIcon = (status) => {
        switch (String(status || '').toLowerCase()) {
            case 'completed': return <CheckCircle2 size={16} />;
            case 'upcoming':
            case 'pending':
            case 'ongoing': return <Clock size={16} />;
            case 'missed':
            case 'overdue': return <AlertCircle size={16} />;
            default: return null;
        }
    };

    const completedCount = vaccines.filter(v => (v.status || '').toString().toLowerCase() === 'completed').length;
    const totalCount = vaccines.length;

    if (loading) {
        return (
            <StaffPageLoader 
                message={t('vac_loading') || 'Loading vaccines and supplements...'} 
                error={error} 
                errorTitle="Unable to load vaccines and supplements"
                onRetry={() => {
                    setLoading(true);
                    loadRef.current?.();
                }} 
            />
        );
    }

    return (
        <div className="user-vaccinations-page staff-page-ready">
            <div className="page-header hero-header-with-img">
                <img 
                    src={vaccinationsSilhouette} 
                    alt="Vaccines & Supplements Silhouette" 
                    className="hero-silhouette-bg" 
                />
                <div className="hero-content-wrapper">
                    <div className="hero-text-section">
                        <h1 className="page-title">
                            <Syringe size={22} className="header-icon" style={{ display: 'inline', marginRight: '6px' }} /> {t('vac_title', 'Vaccines & Supplements')}
                        </h1>
                        <p className="page-subtitle">{t('vac_subtitle')}</p>
                    </div>
                </div>
            </div>

            <div className="uv-progress-section">
                <div className="uv-progress-card">
                    <div className="uv-progress-info">
                        <span>{t('vac_progress')}</span>
                        <strong>{t('vac_progress_count', '{completed} of {total} items completed').replace('{completed}', completedCount).replace('{total}', totalCount)}</strong>
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
                    {['All', 'Mother', 'Newborn'].map(f => (
                        <button 
                            key={f}
                            className={`uv-filter-btn ${filter === f ? 'active' : ''}`}
                            onClick={() => setFilter(f)}
                        >
                            {f === 'Mother' ? <HeartPulse size={14} /> : f === 'Newborn' ? <Baby size={14} /> : null}
                            {f === 'All' ? t('vac_all') : f === 'Mother' ? t('vac_mother', 'Mother') : t('vac_newborn')}
                        </button>
                    ))}
                </div>
            </div>

            <div className="uv-cards-grid">
                {filteredVaccines.length > 0 ? (
                    filteredVaccines.map((vaccine, index) => {
                        const status = vaccine.status || 'Unknown';
                        const isMother = isMotherVaccine(vaccine);
                        const isSupplement = vaccine.itemType === 'supplement';
                        const category = isMother ? 'Mother' : 'Newborn';
                        const displayName = isSupplement
                            ? vaccine.supplement_name || vaccine.name || 'Supplement'
                            : vaccine.notes || vaccine.vaccine_name || vaccine.name || 'Vaccine';
                        const desc = vaccine.description || '';
                        const safeId = `${isSupplement ? 'supplement' : 'vaccine'}-${vaccine.id || `${displayName}-${index}`}`;
                        return (
                            <div 
                                key={safeId} 
                                className={`uv-vaccine-card status-${String(status).toLowerCase()}`}
                                onClick={() => setSelectedVaccine({
                                    ...vaccine,
                                    category: isSupplement
                                        ? `${category} Supplement`
                                        : category
                                })}
                            >
                                <div className="uv-card-header">
                                    <span className={`uv-category-tag ${isMother ? 'mother' : 'newborn'}`}>
                                        {isMother
                                            ? (isSupplement
                                                ? t('vac_my_supplement', 'Mother Supplement')
                                                : t('vac_my_vaccine', 'Mother Vaccine'))
                                            : (isSupplement
                                                ? t('vac_baby_supplement', "{name}'s Supplement").replace('{name}', vaccine.personName || 'Baby')
                                                : t('vac_baby_vaccine', "{name}'s Vaccine").replace('{name}', vaccine.personName || 'Baby'))}
                                    </span>
                                    <span className={`uv-status-badge status-${String(status).toLowerCase()}`}>
                                        {getStatusIcon(status)} 
                                        {{
                                            'Completed': t('vax_modal_status_completed', 'Completed'),
                                            'Upcoming': t('vax_modal_status_upcoming', 'Pending'),
                                            'Missed': t('vax_modal_status_missed', 'Missed')
                                        }[status] || status}
                                    </span>
                                </div>
                                <h3 className="uv-vaccine-name">
                                    {isSupplement ? displayName : `Scheduled: ${displayName}`}
                                </h3>
                                {!isSupplement && vaccine.vaccine_inventory && (
                                    <p className="uv-vaccine-desc">
                                        Actual Vaccine Given: {vaccine.vaccine_inventory.vaccine_name}
                                        {vaccine.vaccine_inventory.brand ? ` · Brand: ${vaccine.vaccine_inventory.brand}` : ''}
                                    </p>
                                )}
                                <p className="uv-vaccine-person">
                                    {t('vac_for', 'For:')} <strong>{isMother ? (patientInfo.name && patientInfo.name !== 'N/A' ? patientInfo.name : 'Mother') : (vaccine.personName || 'Baby')}</strong>
                                    {!isMother && vaccine.pregnancyNumber && <span> · Pregnancy #{vaccine.pregnancyNumber}</span>}
                                </p>
                                <p className="uv-vaccine-desc">{desc}</p>
                                <div className="uv-vaccine-schedule">
                                    {isSupplement ? (
                                        <>
                                            {vaccine.dosage && (
                                                <div className="uv-schedule-item">
                                                    <span className="label">{t('vac_dosage', 'Dosage:')}</span>
                                                    <span className="value">{vaccine.dosage}</span>
                                                </div>
                                            )}
                                            {vaccine.start_date && (
                                                <div className="uv-schedule-item">
                                                    <span className="label">{t('vac_start_date', 'Start date:')}</span>
                                                    <span className="value">{new Date(vaccine.start_date).toLocaleDateString('en-PH')}</span>
                                                </div>
                                            )}
                                            {vaccine.end_date && (
                                                <div className="uv-schedule-item">
                                                    <span className="label">{t('vac_end_date', 'End date:')}</span>
                                                    <span className="value">{new Date(vaccine.end_date).toLocaleDateString('en-PH')}</span>
                                                </div>
                                            )}
                                            {!vaccine.start_date && !vaccine.end_date && vaccine.created_at && (
                                                <div className="uv-schedule-item">
                                                    <span className="label">{t('vac_recorded', 'Recorded:')}</span>
                                                    <span className="value">{new Date(vaccine.created_at).toLocaleDateString('en-PH')}</span>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="uv-schedule-item">
                                            <span className="label">{t('vac_recommended')}</span>
                                            <span className="value">{vaccine.schedule || t('vac_as_advised')}</span>
                                        </div>
                                    )}
                                    {!isSupplement && vaccine.vaccinated_date && (
                                        <div className="uv-schedule-item">
                                            <span className="label">{t('vac_vaccinated')}</span>
                                            <span className="value">{new Date(vaccine.vaccinated_date).toLocaleDateString('en-PH')}</span>
                                        </div>
                                    )}
                                    {!isSupplement && vaccine.scheduled_vaccination && (
                                        <div className="uv-schedule-item">
                                            <span className="label">{t('vac_scheduled')}</span>
                                            <span className="value">{new Date(vaccine.scheduled_vaccination).toLocaleDateString('en-PH')}</span>
                                        </div>
                                    )}
                                </div>
                                {(((vaccine.assigned_staff_name || vaccine.administered_by_name) && !isUUID(vaccine.assigned_staff_name || vaccine.administered_by_name)) || vaccine.assigned_staff_station || vaccine.service_station_name) && (
                                    <div className="uv-assigned-staff">
                                        {(vaccine.assigned_staff_name || vaccine.administered_by_name) && !isUUID(vaccine.assigned_staff_name || vaccine.administered_by_name) && (
                                            <span><UserRound size={14} /> Health worker: <strong>{vaccine.assigned_staff_name || vaccine.administered_by_name}</strong></span>
                                        )}
                                        {(vaccine.assigned_staff_station || vaccine.service_station_name) && <span><MapPin size={14} /> Assigned station: <strong>{vaccine.assigned_staff_station || vaccine.service_station_name}</strong></span>}
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
                        <p>
                            {searchTerm 
                                ? t('vac_no_results', 'No vaccines found matching your search or filter.') 
                                : filter === 'Mother'
                                    ? t('vac_no_mother_records', 'No maternal vaccination records found.')
                                    : filter === 'Newborn'
                                        ? t('vac_no_newborn_records', 'No newborn vaccination records found.')
                                        : t('vac_no_records', 'No vaccination records available.')
                            }
                        </p>
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
