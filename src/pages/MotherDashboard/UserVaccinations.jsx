import React, { useState, useEffect } from 'react';
import AuthService from '../../services/authservice';
import { loadMotherPatient } from '../../services/motherOfflineService';
import { 
    Syringe, Search, Filter, Calendar, 
    CheckCircle2, Clock, AlertCircle, 
    ChevronRight, Info, Download, Printer,
    HeartPulse, Baby, ArrowLeft
} from 'lucide-react';
import '../../styles/pages/UserVaccinations.css';
import VaccineDetailModal from '../../components/MotherDashboard/VaccineDetailModal';
import { useNavigate } from 'react-router-dom';
import vaccinationsSilhouette from '../../assets/images/vaccinations-silhouette.png';

const UserVaccinations = () => {
    const navigate = useNavigate();
    const [vaccines, setVaccines] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState('All');
    const [selectedVaccine, setSelectedVaccine] = useState(null);

    useEffect(() => {
        const load = async () => {
            const auth = new AuthService();
            try {
                const authUser = await auth.getAuthUser();
                if (!authUser?.id) return;
                const patient = await loadMotherPatient(authUser);
                
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
                    patient.newborns.forEach(newborn => {
                        if (newborn.vaccines && newborn.vaccines.length > 0) {
                            allVaccines = allVaccines.concat(newborn.vaccines.map(v => ({
                                ...v,
                                personType: 'child',
                                personName: newborn.baby_name || `Baby`
                            })));
                        }
                    });
                }
                
                setVaccines(allVaccines);
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
                            <Syringe size={22} className="header-icon" style={{ display: 'inline', marginRight: '6px' }} /> Vaccinations
                        </h1>
                        <p className="page-subtitle">Keep track of your and your baby's vaccinations to ensure safety and healthy development</p>
                        <div className="hero-badges-row">
                            <button className="vitals-badge-btn" title="Print Schedule">
                                <Printer size={16} /> Print
                            </button>
                            <button className="vitals-badge-btn" title="Download PDF">
                                <Download size={16} /> Download
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="uv-progress-section">
                <div className="uv-progress-card">
                    <div className="uv-progress-info">
                        <span>Overall Progress</span>
                        <strong>{completedCount} of {totalCount} vaccinations completed</strong>
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
                        placeholder="Search by vaccine name..." 
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
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            <div className="uv-cards-grid">
                {filteredVaccines.length > 0 ? (
                    filteredVaccines.map(vaccine => {
                        const status = vaccine.status || 'Unknown';
                        // Determine category based on person type: self = Maternal, child = Newborn
                        const category = vaccine.personType === 'self' ? 'Maternal' : 'Newborn';
                        // NOTES COLUMN IS THE VACCINE NAME - use it as primary display
                        const displayName = vaccine.notes || vaccine.vaccine_name || vaccine.name || 'Vaccine';
                        const desc = vaccine.description || '';
                        const safeId = vaccine.id || `${displayName}-${Math.random().toString(36).slice(2,8)}`;
                        return (
                            <div 
                                key={safeId} 
                                className={`uv-vaccine-card status-${String(status).toLowerCase()}`}
                                onClick={() => setSelectedVaccine(vaccine)}
                            >
                                <div className="uv-card-header">
                                    <span className={`uv-category-tag ${String(category).toLowerCase()}`}>
                                        {vaccine.personType === 'self' ? 'My Vaccine' : `${vaccine.personName}'s Vaccine`}
                                    </span>
                                    <span className={`uv-status-badge status-${String(status).toLowerCase()}`}>
                                        {getStatusIcon(status)} {status}
                                    </span>
                                </div>
                                <h3 className="uv-vaccine-name">{displayName}</h3>
                                {vaccine.personType === 'child' && (
                                    <p className="uv-vaccine-person">For: <strong>{vaccine.personName}</strong></p>
                                )}
                                <p className="uv-vaccine-desc">{desc}</p>
                                <div className="uv-vaccine-schedule">
                                    <div className="uv-schedule-item">
                                        <span className="label">Recommended:</span>
                                        <span className="value">{vaccine.schedule || 'As advised'}</span>
                                    </div>
                                    {vaccine.vaccinated_date && (
                                        <div className="uv-schedule-item">
                                            <span className="label">Vaccinated:</span>
                                            <span className="value">{new Date(vaccine.vaccinated_date).toLocaleDateString('en-PH')}</span>
                                        </div>
                                    )}
                                    {vaccine.scheduled_vaccination && vaccine.status !== 'Completed' && (
                                        <div className="uv-schedule-item">
                                            <span className="label">Scheduled:</span>
                                            <span className="value">{new Date(vaccine.scheduled_vaccination).toLocaleDateString('en-PH')}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="uv-card-footer">
                                    <span>Click for details</span>
                                    <ChevronRight size={14} />
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="uv-no-results">
                        <Info size={40} />
                        <p>No vaccines found matching your search or filter.</p>
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
