import React, { useState, useEffect } from 'react';
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

const isUUID = (val) => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim());

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
                
                const fullName = patient ? [patient.first_name, patient.middle_name, patient.last_name, patient.suffix].filter(Boolean).join(' ') : 'N/A';

                let allVaccines = [];
                
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
                                recipient_type: 'Baby',
                                category: 'Newborn',
                                personName: newborn.baby_name || 'Baby',
                                pregnancyNumber: pregnancyByDeliveryId.get(newborn.delivery_id) || null
                            })));
                        }
                    });
                }

                allVaccines.sort((left, right) => {
                    const leftDate = left.scheduled_vaccination || left.vaccinated_date || '';
                    const rightDate = right.scheduled_vaccination || right.vaccinated_date || '';
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
            }
        };
        load();
    }, []);

    const isMotherVaccine = (v) =>
        v.recipient_type === 'Mother' || v.personType === 'self' || (!v.newborn_id && Boolean(v.patient_id));

    const filteredVaccines = vaccines.filter(v => {
        // Use notes as vaccine guide display name - this is the primary vaccine identifier
        const displayName = v.notes || v.vaccine_name || v.name || '';
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
        switch (status) {
            case 'Completed': return <CheckCircle2 size={16} />;
            case 'Upcoming': return <Clock size={16} />;
            case 'Missed': return <AlertCircle size={16} />;
            default: return null;
        }
    };

    const completedCount = vaccines.filter(v => (v.status || '').toString().toLowerCase() === 'completed').length;
    const totalCount = vaccines.length;

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
                        const category = isMother ? 'Mother' : 'Newborn';
                        // NOTES COLUMN IS THE VACCINE NAME - use it as primary display
                        const displayName = vaccine.notes || vaccine.vaccine_name || vaccine.name || 'Vaccine';
                        const desc = vaccine.description || '';
                        const safeId = vaccine.id || `${displayName}-${index}`;
                        return (
                            <div 
                                key={safeId} 
                                className={`uv-vaccine-card status-${String(status).toLowerCase()}`}
                                onClick={() => setSelectedVaccine({ ...vaccine, category })}
                            >
                                <div className="uv-card-header">
                                    <span className={`uv-category-tag ${isMother ? 'mother' : 'newborn'}`}>
                                        {isMother 
                                            ? t('vac_my_vaccine', 'Mother Vaccine') 
                                            : t('vac_baby_vaccine', "{name}'s Vaccine").replace('{name}', vaccine.personName || 'Baby')}
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
                                <h3 className="uv-vaccine-name">Scheduled: {displayName}</h3>
                                {vaccine.vaccine_inventory && (
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
                                {((vaccine.assigned_staff_name && !isUUID(vaccine.assigned_staff_name)) || vaccine.assigned_staff_station) && (
                                    <div className="uv-assigned-staff">
                                        {vaccine.assigned_staff_name && !isUUID(vaccine.assigned_staff_name) && (
                                            <span><UserRound size={14} /> Health worker: <strong>{vaccine.assigned_staff_name}</strong></span>
                                        )}
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
