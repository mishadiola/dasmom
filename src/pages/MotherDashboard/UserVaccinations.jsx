import React, { useState } from 'react';
import { 
    Syringe, Search, Filter, Calendar, 
    CheckCircle2, Clock, AlertCircle, 
    ChevronRight, Info, Download, Printer,
    HeartPulse, Baby, ArrowLeft
} from 'lucide-react';
import '../../styles/pages/UserVaccinations.css';
import VaccineDetailModal from '../../components/MotherDashboard/VaccineDetailModal';
import { useNavigate } from 'react-router-dom';

const VACCINATION_DATA = [
    {
        id: 1,
        name: 'Tetanus Toxoid (TT)',
        category: 'Maternal',
        description: 'Prevents tetanus infection in mother and newborn.',
        schedule: '2 doses',
        lastTaken: 'Feb 10, 2026',
        nextDue: 'Apr 10, 2026',
        status: 'Upcoming',
        importance: 'Protects against maternal and neonatal tetanus, a serious disease caused by bacteria found in soil.',
        sideEffects: 'Mild soreness at the injection site, slight fever.',
        tips: 'Take with iron supplements for better absorption and stay hydrated.',
        sources: [
            { name: 'DOH Philippines', title: 'National Immunization Program Guidelines', url: 'https://doh.gov.ph' },
            { name: 'World Health Organization (WHO)', title: 'Tetanus vaccine: WHO position paper', url: 'https://www.who.int/publications/i/item/WHO-WER9206' }
        ]
    },
    {
        id: 2,
        name: 'Hepatitis B (Hepa B)',
        category: 'Newborn',
        description: 'Protects the baby against Hepatitis B virus.',
        schedule: '3 doses',
        lastTaken: 'Feb 26, 2026',
        nextDue: 'Mar 26, 2026',
        status: 'Completed',
        importance: 'Hepatitis B is a virus that infects the liver. Babies can get it from their mothers during birth.',
        sideEffects: 'Low-grade fever, fussiness.',
        tips: 'Ensure the baby is comfortable and monitor for any unusual reactions.',
        sources: [
            { name: 'World Health Organization (WHO)', title: 'Hepatitis B', url: 'https://www.who.int/news-room/fact-sheets/detail/hepatitis-b' },
            { name: 'DOH Philippines', title: 'Hepatitis B Immunization Program', url: 'https://doh.gov.ph' }
        ]
    },
    {
        id: 3,
        name: 'Influenza (Flu Shot)',
        category: 'Maternal',
        description: 'Protects mother and baby from serious flu complications.',
        schedule: '1 dose yearly',
        lastTaken: null,
        nextDue: 'Oct 2026',
        status: 'Upcoming',
        importance: 'Pregnant women are at higher risk for severe illness from the flu.',
        sideEffects: 'Redness at injection site, mild body aches.',
        tips: 'Best taken before the flu season starts.',
        sources: [
            { name: 'CDC', title: 'Flu Vaccine and Pregnancy', url: 'https://www.cdc.gov/flu/highrisk/pregnant.htm' },
            { name: 'World Health Organization (WHO)', title: 'Influenza (Seasonal)', url: 'https://www.who.int/news-room/fact-sheets/detail/influenza-(seasonal)' }
        ]
    },
    {
        id: 4,
        name: 'BCG Vaccine',
        category: 'Newborn',
        description: 'Protects newborn from tuberculosis.',
        schedule: 'At birth',
        lastTaken: 'Feb 26, 2026',
        nextDue: 'None',
        status: 'Completed',
        importance: 'Helps prevent severe forms of tuberculosis in infants.',
        sideEffects: 'A small scar typically forms at the site of injection.',
        tips: 'Keep the injection site clean and dry.',
        sources: [
            { name: 'World Health Organization (WHO)', title: 'BCG vaccine: WHO position paper', url: 'https://www.who.int/publications/i/item/WHO-WER9308' },
            { name: 'DOH Philippines', title: 'National Tuberculosis Control Program', url: 'https://doh.gov.ph' }
        ]
    },
    {
        id: 5,
        name: 'Oral Polio Vaccine (OPV)',
        category: 'Newborn',
        description: 'Prevents the spread of poliomyelitis.',
        schedule: '3 doses',
        lastTaken: null,
        nextDue: 'Mar 15, 2026',
        status: 'Upcoming',
        importance: 'Polio is a crippling and potentially deadly infectious disease.',
        sideEffects: 'Very few reported side effects.',
        tips: 'Administered orally as drops.',
        sources: [
            { name: 'World Health Organization (WHO)', title: 'Poliomyelitis (Polio)', url: 'https://www.who.int/news-room/fact-sheets/detail/poliomyelitis' },
            { name: 'UNICEF', title: 'Polio Vaccination Strategies', url: 'https://www.unicef.org/immunization/polio' }
        ]
    }
];

const UserVaccinations = () => {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState('All');
    const [selectedVaccine, setSelectedVaccine] = useState(null);

    const filteredVaccines = VACCINATION_DATA.filter(v => {
        const matchesSearch = v.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = filter === 'All' || v.category === filter;
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

    const completedCount = VACCINATION_DATA.filter(v => v.status === 'Completed').length;
    const totalCount = VACCINATION_DATA.length;

    return (
        <div className="user-vaccinations-page">
            <header className="mother-page-header">
                <div className="mother-page-header-content">
                    <button className="back-btn" onClick={() => navigate('/mother-home')}>
                        <ArrowLeft size={18} />
                    </button>
                    <div className="mother-page-header-text">
                        <h1>Vaccinations</h1>
                        <p>Keep track of your and your baby's vaccinations to ensure safety and healthy development</p>
                    </div>
                </div>
                <div className="mother-page-header-actions">
                    <button className="uv-btn-icon" title="Print Schedule"><Printer size={18} /></button>
                    <button className="uv-btn-icon" title="Download PDF"><Download size={18} /></button>
                </div>
            </header>

            <div className="uv-progress-section">
                <div className="uv-progress-card">
                    <div className="uv-progress-info">
                        <span>Overall Progress</span>
                        <strong>{completedCount} of {totalCount} vaccinations completed</strong>
                    </div>
                    <div className="uv-progress-bar-wrap">
                        <div 
                            className="uv-progress-bar-fill" 
                            style={{ width: `${(completedCount / totalCount) * 100}%` }}
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
                    filteredVaccines.map(vaccine => (
                        <div 
                            key={vaccine.id} 
                            className={`uv-vaccine-card status-${vaccine.status.toLowerCase()}`}
                            onClick={() => setSelectedVaccine(vaccine)}
                        >
                            <div className="uv-card-header">
                                <span className={`uv-category-tag ${vaccine.category.toLowerCase()}`}>
                                    {vaccine.category}
                                </span>
                                <span className={`uv-status-badge status-${vaccine.status.toLowerCase()}`}>
                                    {getStatusIcon(vaccine.status)} {vaccine.status}
                                </span>
                            </div>
                            <h3 className="uv-vaccine-name">{vaccine.name}</h3>
                            <p className="uv-vaccine-desc">{vaccine.description}</p>
                            <div className="uv-vaccine-schedule">
                                <div className="uv-schedule-item">
                                    <span className="label">Recommended:</span>
                                    <span className="value">{vaccine.schedule}</span>
                                </div>
                                {vaccine.lastTaken && (
                                    <div className="uv-schedule-item">
                                        <span className="label">Last Taken:</span>
                                        <span className="value">{vaccine.lastTaken}</span>
                                    </div>
                                )}
                                {vaccine.nextDue && vaccine.nextDue !== 'None' && (
                                    <div className="uv-schedule-item">
                                        <span className="label">Next Due:</span>
                                        <span className="value">{vaccine.nextDue}</span>
                                    </div>
                                )}
                            </div>
                            <div className="uv-card-footer">
                                <span>Click for details</span>
                                <ChevronRight size={14} />
                            </div>
                        </div>
                    ))
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
