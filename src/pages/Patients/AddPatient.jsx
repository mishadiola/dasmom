import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import {
    ArrowLeft, Save, X, FileText, User, Activity,
    Calendar, HeartPulse, UploadCloud, AlertTriangle,
    CheckCircle2, XCircle, Loader2
} from 'lucide-react';
import '../../styles/pages/AddPatient.css';
import PatientService from "../../services/patientservice";

const patientService = new PatientService();

const TABS = [
    { id: 'personal', label: 'Personal', icon: User },
    { id: 'pregnancy', label: 'Pregnancy', icon: HeartPulse },
    { id: 'medical', label: 'Medical', icon: Activity },
    { id: 'prenatal', label: 'Prenatal', icon: Calendar },
    { id: 'documents', label: 'Documents', icon: FileText },
];

const MEDICAL_CONDITIONS = [
    'Hypertension', 'Diabetes', 'Heart Disease', 'Asthma',
    'Anemia', 'Previous C-section'
];

const AddPatient = () => {
    const navigate = useNavigate();
    const { user } = useContext(AuthContext);
    
    const [activeTab, setActiveTab] = useState('personal');
    const [toast, setToast] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [missingFields, setMissingFields] = useState([]);
    const [loadingStations, setLoadingStations] = useState(true);

    const [availableStations, setAvailableStations] = useState([]);
    const [midwifeList, setMidwifeList] = useState([]);
    const [doctorList, setDoctorList] = useState([]);

    const currentStaff = {
        id: user?.id || null,
        full_name: user ? `${user.email} (Admin)` : 'Admin User'
    };

    const [formData, setFormData] = useState({
        firstName: '', middleName: '', lastName: '', suffix: '',
        dob: '', age: '', civilStatus: '', contactNumber: '', email: '',
        alternateContact: '', address: '', station: '', municipality: 'Dasmariñas',
        province: 'Cavite', philhealth: '', validId: '',
        pregnancyStatus: 'Pregnant', gravida: '', para: '',
        lmp: '', edd: '', gestationalAge: '', pregnancyType: 'Singleton',
        plannedDeliveryPlace: 'Hospital',
        conditions: [], otherConditions: '', riskLevel: 'Low Risk',
        firstVisitDate: '', assignedMidwife: '', assignedDoctor: '',
        bhwAssigned: currentStaff.full_name,
        bp: '', weight: '', height: '', bmi: '', fhr: '', hgb: '',
        emName: '', emRel: '', emPhone: '', emAddress: '',
    });

    useEffect(() => {
        const loadStations = async () => {
            try {
                const stations = await patientService.getAvailableStations();
                setAvailableStations(stations);
                console.log('✅ Available stations loaded:', stations);
            } catch (err) {
                console.error(err);
            } finally {
                setLoadingStations(false);
            }
        };
        loadStations();
    }, []);

    useEffect(() => {
        if (user) {
            const bhwName = `${user.email} (Admin)`;
            setFormData(prev => ({ ...prev, bhwAssigned: bhwName }));
            console.log('✅ BHW from AuthContext:', bhwName);
        }
    }, [user]);

    useEffect(() => {
        const filterStaff = async () => {
            if (!formData.station || loadingStations) return;
            try {
                const allMidwives = await patientService.getAllMidwives();
                const filteredMidwives = allMidwives.filter(mw => mw.station_assignment === formData.station);
                setMidwifeList(filteredMidwives);

                const doctors = await patientService.getDoctorsByStation(formData.station);
                setDoctorList(doctors);
                console.log(`✅ Staff filtered for ${formData.station}:`, { midwives: filteredMidwives.length, doctors: doctors.length });
            } catch (err) {
                console.error(err);
            }
        };
        filterStaff();
    }, [formData.station, loadingStations]);

    useEffect(() => {
        if (formData.dob) {
            const today = new Date();
            const birthDate = new Date(formData.dob);
            let age = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
            setFormData(prev => ({ ...prev, age: age.toString() }));
        }
    }, [formData.dob]);

    useEffect(() => {
        if (formData.lmp) {
            const lmpDate = new Date(formData.lmp);
            const eddDate = new Date(lmpDate);
            eddDate.setDate(eddDate.getDate() + 280);

            const today = new Date();
            const diffTime = Math.abs(today - lmpDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            const weeks = Math.floor(diffDays / 7);
            const days = diffDays % 7;

            setFormData(prev => ({
                ...prev,
                edd: eddDate.toISOString().split('T')[0],
                gestationalAge: `${weeks}w ${days}d`
            }));
        }
    }, [formData.lmp]);

    useEffect(() => {
        let risk = 'Low Risk';
        const hasHighRisk = formData.conditions.some(c =>
            ['Hypertension', 'Heart Disease', 'Diabetes', 'Previous C-section'].includes(c)
        );
        const hasMedRisk = formData.conditions.some(c =>
            ['Asthma', 'Anemia'].includes(c)
        );

        if (hasHighRisk) risk = 'High Risk';
        else if (hasMedRisk) risk = 'Medium Risk';

        setFormData(prev => ({ ...prev, riskLevel: risk }));
    }, [formData.conditions]);

    const handleChange = (e) => {
        const { name, value, type } = e.target;
        const isText = type === 'text' || e.target.tagName === 'TEXTAREA';
        let finalValue = isText ? value.toUpperCase() : value;

        if (name === 'contactNumber' || name === 'emPhone') {
            finalValue = finalValue.replace(/\D/g, '').slice(0, 11);
        }

        setFormData(prev => ({ ...prev, [name]: finalValue }));

        if (missingFields.includes(name) || missingFields.includes(name + '-invalid')) {
            setMissingFields(prev => prev.filter(f => f !== name && f !== name + '-invalid'));
        }
    };

    const handleCheckbox = (condition) => {
        setFormData(prev => {
            const current = [...prev.conditions];
            if (current.includes(condition)) {
                return { ...prev, conditions: current.filter(c => c !== condition) };
            }
            return { ...prev, conditions: [...current, condition] };
        });
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (isSaving || !user?.id) return;

        const requiredPersonal = ['firstName', 'lastName', 'dob', 'email', 'contactNumber', 'address', 'station'];
        const requiredEmergency = ['emName', 'emRel', 'emPhone', 'emAddress'];
        const requiredPregnancy = ['gravida', 'para', 'lmp'];
        const requiredVitals = ['bp', 'weight', 'height'];

        const missing = [];
        const checkFields = (fields) => fields.forEach(f => {
            if (!formData[f]) {
                missing.push(f);
            } 
            else if ((f === 'contactNumber' || f === 'emPhone') && formData[f].length !== 11) {
                missing.push(f + '-invalid');
            }
        });
        checkFields(requiredPersonal);
        checkFields(requiredEmergency);
        checkFields(requiredPregnancy);
        checkFields(requiredVitals);
/*
        if (missing.length > 0) {
            setMissingFields(missing);
            setToast({ type: 'error', message: 'Please fill all required fields (*)' });
            return;
        }*/

        setIsSaving(true);

        try {
            const newPatient = await patientService.addPatient(formData, user.id);
            
            console.log('🎉 Patient created:', newPatient.id, newPatient.name);
            
            setToast({ 
                type: 'success', 
                message: `✅ Patient saved successfully!
                👤 ${newPatient.name || formData.firstName + ' ' + formData.lastName}
                📅 12 visits auto-scheduled
                🏘️ ${formData.station}` 
            });

            navigate(`/dashboard/patients/${newPatient.id}`);
            
        } 
        catch (err) {
            console.error('💥 Save failed:', err);
            setToast({ type: 'error', message: `Save failed: ${err.message}` });
        }
        finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="add-patient-page">
            {toast && (
                <div className={`toast toast--${toast.type}`}>
                    <span>{toast.type === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />} {toast.message}</span>
                    <button className="toast-close" onClick={() => setToast(null)}><X size={14} /></button>
                </div>
            )}

            <div className="ap-header">
                <div>
                    <button className="back-link" onClick={() => navigate(-1)}>
                        <ArrowLeft size={16} /> Back to Patient List
                    </button>
                    <h1 className="ap-title">Add New Pregnant Patient</h1>
                    <p>BHW: {currentStaff.full_name} | Available Stations: {availableStations.length}</p>
                </div>
                <div className="ap-actions">
                    <button className="btn btn-outline" onClick={() => navigate(-1)} disabled={isSaving}>
                        <X size={15} /> Cancel
                    </button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={isSaving || !currentStaff.id}>
                        {isSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                        {isSaving ? 'Saving...' : 'Save & Auto-Schedule Visits'}
                    </button>
                </div>
            </div>

            <div className="ap-smart-badges">
                <div className={`smart-badge risk-badge risk-${formData.riskLevel.toLowerCase().split(' ')[0]}`}>
                    {formData.riskLevel === 'High Risk' && <AlertTriangle size={14} />}
                    Auto Risk: {formData.riskLevel}
                </div>
                {formData.gestationalAge && <div className="smart-badge">GA: {formData.gestationalAge}</div>}
                <div className="smart-badge">35 slots/day per Station</div>
            </div>

            <div className="ap-container">
                <aside className="ap-sidebar">
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            className={`ap-tab ${activeTab === tab.id ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab.id)}
                            type="button"
                        >
                            <tab.icon size={18} />
                            {tab.label}
                        </button>
                    ))}
                </aside>

                <form onSubmit={handleSave}>
                    {/* PERSONAL TAB - OLD FIELDS + NEW DROPDOWN */}
                    {activeTab === 'personal' && (
                        <div className="ap-section animate-fade">
                            <h2 className="section-title">Personal Information</h2>
                            <div className="form-grid-3">
                                <div className="form-group">
                                    <label>First Name <span className="req">*</span></label>
                                    <input 
                                        type="text" 
                                        name="firstName" 
                                        value={formData.firstName} 
                                        onChange={handleChange} 
                                        required 
                                        className={missingFields.includes('firstName') ? 'error-field' : ''} 
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Middle Name</label>
                                    <input 
                                        type="text" 
                                        name="middleName" 
                                        value={formData.middleName} 
                                        onChange={handleChange} 
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Last Name <span className="req">*</span></label>
                                    <input 
                                        type="text" 
                                        name="lastName" 
                                        value={formData.lastName} 
                                        onChange={handleChange} 
                                        required 
                                        className={missingFields.includes('lastName') ? 'error-field' : ''} 
                                    />
                                </div>
                            </div>

                            <div className="form-grid-3">
                                <div className="form-group">
                                    <label>Suffix</label>
                                    <input 
                                        type="text" 
                                        name="suffix" 
                                        placeholder="Jr., III" 
                                        value={formData.suffix} 
                                        onChange={handleChange} 
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Date of Birth <span className="req">*</span></label>
                                    <input 
                                        type="date" 
                                        name="dob" 
                                        value={formData.dob} 
                                        onChange={handleChange} 
                                        required 
                                        className={missingFields.includes('dob') ? 'error-field' : ''} 
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Age <i>(Auto)</i></label>
                                    <input type="number" readOnly value={formData.age} className="computed-field" />
                                </div>
                            </div>

                            <div className="form-grid-3">
                                <div className="form-group">
                                    <label>Civil Status</label>
                                    <select name="civilStatus" value={formData.civilStatus} onChange={handleChange}>
                                        <option value="">Select Status</option>
                                        <option value="Single">Single</option>
                                        <option value="Married">Married</option>
                                        <option value="Widowed">Widowed</option>
                                        <option value="Separated">Separated</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Email Address <span className="req">*</span></label>
                                    <input 
                                        type="email" 
                                        name="email" 
                                        value={formData.email} 
                                        onChange={handleChange} 
                                        required
                                        className={missingFields.includes('email') ? 'error-field' : ''} 
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Phone Number <span className="req">*</span></label>
                                    <input 
                                        type="tel" 
                                        name="contactNumber" 
                                        value={formData.contactNumber} 
                                        onChange={handleChange} 
                                        required 
                                        className={missingFields.includes('contactNumber') || missingFields.includes('contactNumber-invalid') ? 'error-field' : ''}
                                    />
                                    {missingFields.includes('contactNumber-invalid') && (
                                        <span className="field-error-msg" style={{color: 'var(--color-rose)', fontSize: '11px', marginTop: '4px', display: 'block'}}>
                                            Phone number must be exactly 11 digits
                                        </span>
                                    )}
                                </div>
                            </div>

                            <h3 className="section-subtitle">Address Details</h3>
                            <div className="form-grid-2">
                                <div className="form-group">
                                    <label>House No. / Street <span className="req">*</span></label>
                                    <input 
                                        type="text" 
                                        name="address" 
                                        value={formData.address} 
                                        onChange={handleChange} 
                                        required 
                                        className={missingFields.includes('address') ? 'error-field' : ''} 
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Station <span className="req">*</span></label>
                                    <select 
                                        name="station" 
                                        value={formData.station} 
                                        onChange={handleChange} 
                                        required 
                                        className={missingFields.includes('station') ? 'error-field' : ''}
                                    >
                                        <option value="">Select Station ({availableStations.length} areas)</option>
                                        {availableStations.map(bgy => (
                                            <option key={bgy} value={bgy}>{bgy}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="form-grid-2">
                                <div className="form-group">
                                    <label>Municipality</label>
                                    <input name="municipality" value={formData.municipality} readOnly />
                                </div>
                                <div className="form-group">
                                    <label>Province</label>
                                    <input name="province" value={formData.province} readOnly />
                                </div>
                            </div>

                            <h3 className="section-subtitle">Government IDs</h3>
                            <div className="form-grid-2">
                                <div className="form-group">
                                    <label>PhilHealth Number</label>
                                    <input name="philhealth" value={formData.philhealth} onChange={handleChange} />
                                </div>
                                <div className="form-group">
                                    <label>Other Valid ID Number</label>
                                    <input name="validId" value={formData.validId} onChange={handleChange} />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* PREGNANCY TAB - OLD FIELDS */}
                    {activeTab === 'pregnancy' && (
                        <div className="ap-section animate-fade">
                            <h2 className="section-title">Pregnancy Information</h2>
                            <div className="form-grid-2">
                                <div className="form-group">
                                    <label>Pregnancy Status</label>
                                    <select name="pregnancyStatus" value={formData.pregnancyStatus} onChange={handleChange}>
                                        <option value="Pregnant">Pregnant</option>
                                        <option value="Postpartum">Postpartum</option>
                                    </select>
                                </div>
                                <div className="form-group duo">
                                    <label>Gravida (Total) <span className="req">*</span></label>
                                    <input 
                                        type="number" 
                                        name="gravida" 
                                        value={formData.gravida} 
                                        onChange={handleChange} 
                                        min="1"
                                        className={missingFields.includes('gravida') ? 'error-field' : ''}
                                    />
                                    <label>Para (Births) <span className="req">*</span></label>
                                    <input 
                                        type="number" 
                                        name="para" 
                                        value={formData.para} 
                                        onChange={handleChange} 
                                        min="0"
                                        className={missingFields.includes('para') ? 'error-field' : ''}
                                    />
                                </div>
                            </div>

                            <div className="form-grid-3">
                                <div className="form-group">
                                    <label>Last Menstrual Period Date <span className="req">*</span></label>
                                    <input 
                                        type="date" 
                                        name="lmp" 
                                        value={formData.lmp} 
                                        onChange={handleChange} 
                                        className={missingFields.includes('lmp') ? 'error-field' : ''}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Expected Date of Delivery</label>
                                    <input type="date" readOnly value={formData.edd} className="computed-field" />
                                </div>
                                <div className="form-group">
                                    <label>Gestational Age</label>
                                    <input type="text" readOnly value={formData.gestationalAge} className="computed-field" />
                                </div>
                            </div>

                            <div className="form-grid-2">
                                <div className="form-group">
                                    <label>Pregnancy Type</label>
                                    <select name="pregnancyType" value={formData.pregnancyType} onChange={handleChange}>
                                        <option value="Singleton">Singleton</option>
                                        <option value="Twins">Twins</option>
                                        <option value="Multiple">Multiple</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Planned Place of Delivery</label>
                                    <select name="plannedDeliveryPlace" value={formData.plannedDeliveryPlace} onChange={handleChange}>
                                        <option value="Hospital">Hospital</option>
                                        <option value="Lying-in">Lying-in Clinic</option>
                                        <option value="Home">Home</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* MEDICAL TAB - OLD FIELDS */}
                    {activeTab === 'medical' && (
                        <div className="ap-section animate-fade">
                            <h2 className="section-title">Medical Risk Assessment</h2>
                            <p className="section-desc">Select all existing medical conditions. The system will auto-compute the risk level based on CHO guidelines.</p>
                            <h3 className="section-subtitle">Pre-existing Conditions</h3>
                            <div className="checkbox-grid">
                                {MEDICAL_CONDITIONS.map(cond => (
                                    <label key={cond} className="custom-checkbox">
                                        <input 
                                            type="checkbox" 
                                            checked={formData.conditions.includes(cond)}
                                            onChange={() => handleCheckbox(cond)} 
                                        />
                                        <span className="checkmark"></span> {cond}
                                    </label>
                                ))}
                            </div>
                            <div className="form-group mt-3">
                                <label>Other Conditions</label>
                                <textarea 
                                    name="otherConditions" 
                                    rows={2} 
                                    value={formData.otherConditions} 
                                    onChange={handleChange} 
                                    placeholder="Specify other conditions here..."
                                />
                            </div>

                            <div className="risk-summary mt-4">
                                <h4>Assessed Risk Level</h4>
                                <div className={`risk-result risk-result--${formData.riskLevel.toLowerCase().split(' ')[0]}`}>
                                    {formData.riskLevel === 'High Risk' && <AlertTriangle size={20} />}
                                    <span>{formData.riskLevel}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* PRENATAL TAB - NEW DROPDOWNS + OLD FIELDS */}
                    {activeTab === 'prenatal' && (
                        <div className="ap-section animate-fade">
                            <h2 className="section-title">Prenatal Care & Initial Vitals</h2>

                            <div className="form-grid-2">
                                <div className="form-group">
                                    <label>Date of First Prenatal Visit</label>
                                    <input 
                                        type="date" 
                                        name="firstVisitDate" 
                                        value={formData.firstVisitDate} 
                                        onChange={handleChange} 
                                    />
                                </div>
                                <div className="form-group">
                                    <label>BHW Assigned</label>
                                    <input value={formData.bhwAssigned} readOnly className="computed-field" />
                                </div>
                            </div>

                            {/* NEW: BARANGAY-SPECIFIC STAFF DROPDOWNS */}
                            <div className="form-grid-2">
                                <div className="form-group">
                                    <label>Assigned Midwife ({formData.station})</label>
                                    <select name="assignedMidwife" value={formData.assignedMidwife} onChange={handleChange}>
                                        <option value="">{midwifeList.length} available in {formData.station}</option>
                                        {midwifeList.map(mw => (
                                            <option key={mw.id} value={mw.id}>{mw.full_name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Assigned Doctor ({formData.station})</label>
                                    <select name="assignedDoctor" value={formData.assignedDoctor} onChange={handleChange}>
                                        <option value="">{doctorList.length} available in {formData.station}</option>
                                        {doctorList.map(doc => (
                                            <option key={doc.id} value={doc.id}>Dr. {doc.full_name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <hr className="divider" />
                            <h3 className="section-subtitle">Initial Vital Signs <span className="req">*</span></h3>
                            <div className="form-grid-3">
                                <div className="form-group">
                                    <label>Blood Pressure (mmHg) <span className="req">*</span></label>
                                    <input 
                                        type="text" 
                                        name="bp" 
                                        placeholder="e.g. 120/80" 
                                        value={formData.bp} 
                                        onChange={handleChange} 
                                        className={missingFields.includes('bp') ? 'error-field' : ''}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Weight (kg) <span className="req">*</span></label>
                                    <input 
                                        type="number" 
                                        name="weight" 
                                        step="0.1" 
                                        value={formData.weight} 
                                        onChange={handleChange} 
                                        className={missingFields.includes('weight') ? 'error-field' : ''}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Height (cm) <span className="req">*</span></label>
                                    <input 
                                        type="number" 
                                        name="height" 
                                        value={formData.height} 
                                        onChange={handleChange} 
                                        className={missingFields.includes('height') ? 'error-field' : ''}
                                    />
                                </div>
                            </div>
                            <div className="form-grid-3">
                                <div className="form-group">
                                    <label>Fetal Heart Rate (bpm)</label>
                                    <input 
                                        type="number" 
                                        name="fhr" 
                                        value={formData.fhr} 
                                        onChange={handleChange} 
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Hemoglobin Level (g/dL)</label>
                                    <input 
                                        type="number" 
                                        name="hgb" 
                                        step="0.1" 
                                        value={formData.hgb} 
                                        onChange={handleChange} 
                                    />
                                </div>
                            </div>

                            <hr className="divider" />
                            <h3 className="section-subtitle">Emergency Contact Details <span className="req">*</span></h3>
                            <div className="form-grid-2">
                                <div className="form-group">
                                    <label>Contact Person Name <span className="req">*</span></label>
                                    <input 
                                        type="text" 
                                        name="emName" 
                                        value={formData.emName} 
                                        onChange={handleChange} 
                                        className={missingFields.includes('emName') ? 'error-field' : ''}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Relationship to Patient <span className="req">*</span></label>
                                    <select 
                                        name="emRel" 
                                        value={formData.emRel} 
                                        onChange={handleChange}
                                        className={missingFields.includes('emRel') ? 'error-field' : ''}
                                    >
                                        <option value="">Select Relationship</option>
                                        <option value="Spouse">Spouse</option>
                                        <option value="Partner">Partner</option>
                                        <option value="Parent">Parent</option>
                                        <option value="Sibling">Sibling</option>
                                        <option value="Guardian">Guardian</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Phone Number <span className="req">*</span></label>
                                    <input 
                                        type="tel" 
                                        name="emPhone" 
                                        value={formData.emPhone} 
                                        onChange={handleChange} 
                                        className={missingFields.includes('emPhone') || missingFields.includes('emPhone-invalid') ? 'error-field' : ''}
                                    />
                                    {missingFields.includes('emPhone-invalid') && (
                                        <span className="field-error-msg" style={{color: 'var(--color-rose)', fontSize: '11px', marginTop: '4px', display: 'block'}}>
                                            Phone number must be exactly 11 digits
                                        </span>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label>Address <span className="req">*</span></label>
                                    <input 
                                        type="text" 
                                        name="emAddress" 
                                        value={formData.emAddress} 
                                        onChange={handleChange} 
                                        className={missingFields.includes('emAddress') ? 'error-field' : ''}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* DOCUMENTS TAB */}
                    {activeTab === 'documents' && (
                        <div className="ap-section animate-fade">
                            <h2 className="section-title">Documents Upload</h2>
                            <p className="section-desc">Attach supporting documents like Ultrasound, Lab results, ID scan, etc.</p>
                            <div className="upload-area">
                                <UploadCloud size={40} className="upload-icon" />
                                <h3>Click to upload or drag & drop</h3>
                                <p>SVG, PNG, JPG or PDF (max. 5MB)</p>
                                <button type="button" className="btn btn-outline mt-3">Browse Files</button>
                            </div>
                            <div className="document-list">
                                <p className="empty-docs">No documents uploaded yet.</p>
                            </div>
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
};

export default AddPatient;
