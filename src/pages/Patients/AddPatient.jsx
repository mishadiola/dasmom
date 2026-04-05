/*import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Save, X, FileText, User, Activity,
    Calendar, HeartPulse, UploadCloud, AlertTriangle,
    CheckCircle2, XCircle, Loader2
} from 'lucide-react';
//import { supabase } from '../../DasmomDatabase';
import '../../styles/pages/AddPatient.css';
import PatientService from "../../services/patientservice";
import AuthService from '../../services/authservice';
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
    const [activeTab, setActiveTab] = useState('personal');
    const [toast, setToast] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        // Personal
        firstName: '', middleName: '', lastName: '', suffix: '',
        dob: '', age: '', civilStatus: '', contactNumber: '', email: '',
        alternateContact: '', address: '', barangay: '', municipality: 'Dasmariñas',
        province: 'Cavite', philhealth: '', validId: '',

        // Pregnancy
        pregnancyStatus: 'Pregnant', gravida: '', para: '',
        lmp: '', edd: '', gestationalAge: '', pregnancyType: 'Singleton',
        plannedDeliveryPlace: 'Hospital',

        // Medical
        conditions: [], otherConditions: '', riskLevel: 'Low Risk',

        // Prenatal
        firstVisitDate: '', assignedMidwife: '',
        bhwAssigned: '',

        // Vitals
        bp: '', weight: '', height: '', bmi: '', fhr: '', hgb: '',

        // Emergency
        emName: '', emRel: '', emPhone: '', emAddress: '',
    });

    // Auto-calculators
    useEffect(() => {
        if (formData.dob) {
            const today = new Date();
            const birthDate = new Date(formData.dob);
            let age = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }
            setFormData(prev => ({ ...prev, age }));
        }
    }, [formData.dob]);

    useEffect(() => {
        if (formData.lmp) {
            // EDD = LMP + 280 days
            const lmpDate = new Date(formData.lmp);
            const eddDate = new Date(lmpDate);
            eddDate.setDate(eddDate.getDate() + 280);

            // GA Calculation
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

    // Handlers
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleCheckbox = (condition) => {
        setFormData(prev => {
            const current = [...prev.conditions];
            if (current.includes(condition)) {
                return { ...prev, conditions: current.filter(c => c !== condition) };
            }
            return { ...prev, conditions: [...current, condition] };
        });
    };*/
/*
    const handleSave = async (e) => {
        e.preventDefault();
        if (isSaving) return;

        // Basic Validation
        const missingPersonal = !formData.firstName || !formData.lastName || !formData.dob || !formData.email || !formData.contactNumber;
        const missingEmergency = !formData.emName || !formData.emRel || !formData.emPhone || !formData.emAddress;

        if (missingPersonal || missingEmergency) {
            setToast({ type: 'error', message: 'Please fill in all required fields (Name, Date of Birth, Email, Phone, Emergency).' });
            setTimeout(() => setToast(null), 3000);
            if (missingPersonal) {
                setActiveTab('personal');
            } else if (missingEmergency) {
                setActiveTab('prenatal');
            }
            return;
        }

        setIsSaving(true);
        window.scrollTo(0, 0);

        try {
            // 1. Get current count to generate sequential ID
            const { count } = await supabase
                .from('patients')
                .select('*', { count: 'exact', head: true });
            
            const nextNum = (count || 0) + 1;
            const currentYear = new Date().getFullYear();
            const patientFormatId = `PT-${currentYear}-A${nextNum}`;

            // 2. Insert Patient
            const { data, error } = await supabase
                .from('patients')
                .insert([{
                    patient_id_format: patientFormatId,
                    first_name: formData.firstName,
                    middle_name: formData.middleName,
                    last_name: formData.lastName,
                    barangay: formData.barangay,
                    date_of_birth: formData.dob,
                    contact_number: formData.contactNumber,
                    emergency_contact: `${formData.emName} (${formData.emRel}) - ${formData.emPhone}`,
                    email: formData.email, // Assume email might be needed or added to table
                    blood_type: formData.civilStatus, // Using civilStatus for now if table doesn't have it, or just match schema
                    lmp: formData.lmp,
                    risk_level: formData.riskLevel,
                    gravida: parseInt(formData.gravida) || 0,
                    para: parseInt(formData.para) || 0,
                    status: 'Active'
                }])
                .select()
                .single();

            if (error) throw error;

            setToast({ type: 'success', message: `Patient successfully saved! ID: ${patientFormatId}` });

            setTimeout(() => {
                if (window.confirm("Do you want to schedule the first prenatal visit?")) {
                    navigate('/dashboard/prenatal');
                } else {
                    navigate(`/dashboard/patients/${data.id}`);
                }
            }, 1500);

        } catch (err) {
            console.error('Error saving patient:', err);
            setToast({ type: 'error', message: 'Failed to save patient. Please check your connection.' });
            setTimeout(() => setToast(null), 4000);
            setIsSaving(false);
        }
    };
*/
/*
const handleSave = async (e) => {
    e.preventDefault();
    if (isSaving) return;

    const missingPersonal = !formData.firstName || !formData.lastName || !formData.dob || !formData.email || !formData.contactNumber;
    const missingEmergency = !formData.emName || !formData.emRel || !formData.emPhone || !formData.emAddress;

    if (missingPersonal || missingEmergency) {
        setToast({ type: 'error', message: 'Please fill in all required fields (Name, Date of Birth, Email, Phone, Emergency).' });
        setTimeout(() => setToast(null), 3000);
        if (missingPersonal) setActiveTab('personal');
        else if (missingEmergency) setActiveTab('prenatal');
        return;
    }

    setIsSaving(true);
    window.scrollTo(0, 0);

    try {
        const patientId = await PatientService.addPatient(formData);

        setToast({ type: 'success', message: `Patient successfully saved! ID: ${patientId}` });

        setTimeout(() => {
            if (window.confirm("Do you want to schedule the first prenatal visit?")) {
                navigate('/dashboard/prenatal');
            } else {
                navigate(`/dashboard/patients/${patientId}`);
            }
        }, 1500);

    } catch (err) {
        console.error('Error saving patient:', err);
        setToast({ type: 'error', message: 'Failed to save patient. Please check your connection.' });
        setIsSaving(false);
    }
};*/
   
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Save, X, FileText, User, Activity,
    Calendar, HeartPulse, UploadCloud, AlertTriangle,
    CheckCircle2, XCircle, Loader2
} from 'lucide-react';
import '../../styles/pages/AddPatient.css';
import PatientService from "../../services/patientservice";
import AuthService from '../../services/authservice';
const authService = new AuthService();

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
    const [activeTab, setActiveTab] = useState('personal');
    const [toast, setToast] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [missingFields, setMissingFields] = useState([]);

    const [currentStaff, setCurrentStaff] = useState({ id: null, fullName: '' });

    const [formData, setFormData] = useState({
        // Personal
        firstName: '', middleName: '', lastName: '', suffix: '',
        dob: '', age: '', civilStatus: '', contactNumber: '', email: '',
        alternateContact: '', address: '', barangay: '', municipality: 'Dasmariñas',
        province: 'Cavite', philhealth: '', validId: '',

        // Pregnancy
        pregnancyStatus: 'Pregnant', gravida: '', para: '',
        lmp: '', edd: '', gestationalAge: '', pregnancyType: 'Singleton',
        plannedDeliveryPlace: 'Hospital',

        // Medical
        conditions: [], otherConditions: '', riskLevel: 'Low Risk',

        // Prenatal
        firstVisitDate: '', assignedMidwife: '',
        bhwAssigned: '',

        // Vitals
        bp: '', weight: '', height: '', bmi: '', fhr: '', hgb: '',

        // Emergency
        emName: '', emRel: '', emPhone: '', emAddress: '',
    });

    useEffect(() => {
        if (formData.dob) {
            const today = new Date();
            const birthDate = new Date(formData.dob);
            let age = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
            setFormData(prev => ({ ...prev, age }));
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

    useEffect(() => {
    const fetchStaff = async () => {
        const staffProfile = await authService.getCurrentStaffProfile();

        console.log("STAFF PROFILE:", staffProfile); // debug

        if (!staffProfile) {
            alert("No staff/admin profile found. Please contact admin.");
            navigate('/login');
            return;
        }

        setCurrentStaff(staffProfile);

        setFormData(prev => ({
            ...prev,
            assignedMidwife: staffProfile.full_name,
            bhwAssigned: staffProfile.full_name
        }));
    };

    fetchStaff();
}, [navigate]);
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
        if (isSaving) return;

        const requiredPersonal = ['firstName', 'lastName', 'dob', 'email', 'contactNumber', 'address', 'barangay'];
        const requiredEmergency = ['emName', 'emRel', 'emPhone', 'emAddress'];
        const requiredPregnancy = ['gravida', 'para', 'lmp'];
        const requiredVitals = ['bp', 'weight', 'height'];

        const missing = [];
        const checkFields = (fields) => fields.forEach(f => {
            if (!formData[f]) {
                missing.push(f);
            } else if ((f === 'contactNumber' || f === 'emPhone') && formData[f].length !== 11) {
                missing.push(f + '-invalid');
            }
        });
        checkFields(requiredPersonal);
        checkFields(requiredEmergency);
        checkFields(requiredPregnancy);
        checkFields(requiredVitals);

        if (missing.length > 0) {
            setMissingFields(missing);
            setToast({ type: 'error', message: 'Please fill in all required fields marked with an asterisk (*).' });
            setTimeout(() => setToast(null), 4000);

            if (requiredPersonal.some(f => missing.includes(f))) setActiveTab('personal');
            else if (requiredPregnancy.some(f => missing.includes(f))) setActiveTab('pregnancy');
            else if (requiredVitals.some(f => missing.includes(f))) setActiveTab('prenatal');
            else if (requiredEmergency.some(f => missing.includes(f))) setActiveTab('prenatal');
            
            return;
        }
        setMissingFields([]);

        if (!currentStaff.id) {
            setToast({ type: 'error', message: 'Cannot save patient without a valid staff profile.' });
            setTimeout(() => setToast(null), 4000);
            return;
        }

        setIsSaving(true);
        window.scrollTo(0, 0);

        try {
            const patientId = await PatientService.addPatient({
                ...formData,
                createdBy: currentStaff.id
            });

            setToast({ type: 'success', message: `Patient successfully saved! ID: ${patientId}` });

            setTimeout(() => {
                if (window.confirm("Do you want to schedule the first prenatal visit?")) {
                    navigate('/dashboard/prenatal');
                } else {
                    navigate(`/dashboard/patients/${patientId}`);
                }
            }, 1500);

        } catch (err) {
            console.error('Error saving patient:', err);
            setToast({ type: 'error', message: 'Failed to save patient. Please check your connection.' });
            setTimeout(() => setToast(null), 4000);
            setIsSaving(false);
        }
    };
    return (
        <div className="add-patient-page">
            {/* Toast Notification */}
            {toast && (
                <div className={`toast toast--${toast.type}`}>
                    <span>{toast.type === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />} {toast.message}</span>
                    <button className="toast-close" onClick={() => setToast(null)}><X size={14} /></button>
                </div>
            )}

            {/* Header */}
            <div className="ap-header">
                <div>
                    <button className="back-link" onClick={() => navigate(-1)}>
                        <ArrowLeft size={16} /> Back to Patient List
                    </button>
                    <h1 className="ap-title">Add New Pregnant Patient</h1>
                </div>
                <div className="ap-actions">
                    <button className="btn btn-outline" onClick={() => navigate(-1)} disabled={isSaving}>
                        <X size={15} /> {isSaving ? 'Please wait...' : 'Cancel'}
                    </button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
                        {isSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                        {isSaving ? 'Saving...' : 'Save Patient'}
                    </button>
                </div>
            </div>

            {/* Smart badges */}
            <div className="ap-smart-badges">
                <div className="smart-badge">System ID: <strong>Pending...</strong></div>
                <div className={`smart-badge risk-badge risk-${formData.riskLevel.toLowerCase().split(' ')[0]}`}>
                    {formData.riskLevel === 'High Risk' && <AlertTriangle size={14} />} Auto-tag: {formData.riskLevel}
                </div>
                {formData.gestationalAge && (
                    <div className="smart-badge info-badge">
                        Term: {formData.gestationalAge}
                    </div>
                )}
            </div>

            {/* Main Form Area */}
            <div className="ap-container">
                {/* Sidebar Tabs */}
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

                {/* Form Content */}
                <form className="ap-content" onSubmit={handleSave}>

                    {/* PERSONAL TAB */}
                    {activeTab === 'personal' && (
                        <div className="ap-section animate-fade">
                            <h2 className="section-title">Personal Information</h2>

                            <div className="form-grid-3">
                                <div className="form-group">
                                    <label>First Name <span className="req">*</span></label>
                                    <input type="text" name="firstName" value={formData.firstName} onChange={handleChange} required className={missingFields.includes('firstName') ? 'error-field' : ''} />
                                </div>
                                <div className="form-group">
                                    <label>Middle Name</label>
                                    <input type="text" name="middleName" value={formData.middleName} onChange={handleChange} />
                                </div>
                                <div className="form-group">
                                    <label>Last Name <span className="req">*</span></label>
                                    <input type="text" name="lastName" value={formData.lastName} onChange={handleChange} required className={missingFields.includes('lastName') ? 'error-field' : ''} />
                                </div>
                            </div>

                            <div className="form-grid-3">
                                <div className="form-group">
                                    <label>Suffix</label>
                                    <input type="text" name="suffix" placeholder="Jr., III" value={formData.suffix} onChange={handleChange} />
                                </div>
                                <div className="form-group">
                                    <label>Date of Birth <span className="req">*</span></label>
                                    <input type="date" name="dob" value={formData.dob} onChange={handleChange} required className={missingFields.includes('dob') ? 'error-field' : ''} />
                                </div>
                                <div className="form-group">
                                    <label>Age <i>(Auto-computed)</i></label>
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
                                    <input type="email" name="email" value={formData.email} onChange={handleChange} required className={missingFields.includes('email') ? 'error-field' : ''} />
                                </div>
                                <div className="form-group">
                                    <label>Phone Number <span className="req">*</span></label>
                                    <input type="tel" name="contactNumber" value={formData.contactNumber} onChange={handleChange} required className={missingFields.includes('contactNumber') || missingFields.includes('contactNumber-invalid') ? 'error-field' : ''} />
                                    {missingFields.includes('contactNumber-invalid') && <span className="field-error-msg" style={{color: 'var(--color-rose)', fontSize: '11px', marginTop: '4px', display: 'block'}}>Phone number must be exactly 11 digits</span>}
                                </div>
                            </div>

                            <h3 className="section-subtitle">Address Details</h3>
                            <div className="form-grid-2">
                                <div className="form-group">
                                    <label>House No. / Street <span className="req">*</span></label>
                                    <input type="text" name="address" value={formData.address} onChange={handleChange} required className={missingFields.includes('address') ? 'error-field' : ''} />
                                </div>
                                <div className="form-group">
                                    <label>Barangay <span className="req">*</span></label>
                                    <select name="barangay" value={formData.barangay} onChange={handleChange} required className={missingFields.includes('barangay') ? 'error-field' : ''}>
                                        <option value="">Select Barangay</option>
                                        {[1, 2, 3, 4, 5, 6, 7].map(n => (
                                            <option key={n} value={`Brgy. ${n}`}>Brgy. {n}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Municipality</label>
                                    <input type="text" name="municipality" value={formData.municipality} onChange={handleChange} readOnly />
                                </div>
                                <div className="form-group">
                                    <label>Province</label>
                                    <input type="text" name="province" value={formData.province} onChange={handleChange} readOnly />
                                </div>
                            </div>

                            <h3 className="section-subtitle">Government IDs</h3>
                            <div className="form-grid-2">
                                <div className="form-group">
                                    <label>PhilHealth Number</label>
                                    <input type="text" name="philhealth" value={formData.philhealth} onChange={handleChange} />
                                </div>
                                <div className="form-group">
                                    <label>Other Valid ID Number</label>
                                    <input type="text" name="validId" value={formData.validId} onChange={handleChange} />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* PREGNANCY TAB */}
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
                                    <div>
                                        <label>Gravida (Total) <span className="req">*</span></label>
                                        <input type="number" name="gravida" value={formData.gravida} onChange={handleChange} min="1" className={missingFields.includes('gravida') ? 'error-field' : ''} />
                                    </div>
                                    <div>
                                        <label>Para (Births) <span className="req">*</span></label>
                                        <input type="number" name="para" value={formData.para} onChange={handleChange} min="0" className={missingFields.includes('para') ? 'error-field' : ''} />
                                    </div>
                                </div>
                            </div>

                            <div className="form-grid-3">
                                <div className="form-group">
                                    <label>Last Menstrual Period Date <span className="req">*</span></label>
                                    <input type="date" name="lmp" value={formData.lmp} onChange={handleChange} className={missingFields.includes('lmp') ? 'error-field' : ''} />
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

                    {/* MEDICAL TAB */}
                    {activeTab === 'medical' && (
                        <div className="ap-section animate-fade">
                            <h2 className="section-title">Medical & Risk Assessment</h2>
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
                                        <span className="checkmark"></span>
                                        {cond}
                                    </label>
                                ))}
                            </div>

                            <div className="form-group mt-3">
                                <label>Other Conditions</label>
                                <textarea name="otherConditions" rows="2" value={formData.otherConditions} onChange={handleChange} placeholder="Specify other conditions here..."></textarea>
                            </div>

                            <div className="risk-summary mt-4">
                                <h4>Assessed Risk Level</h4>
                                <div className={`risk-result risk-result--${formData.riskLevel.toLowerCase().split(' ')[0]}`}>
                                    <AlertTriangle size={20} />
                                    <span>{formData.riskLevel}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* PRENATAL & VITALS TAB */}
                    {activeTab === 'prenatal' && (
                        <div className="ap-section animate-fade">
                            <h2 className="section-title">Prenatal Care & Initial Vitals</h2>

                            <div className="form-grid-2">
                                <div className="form-group">
                                    <label>Date of First Prenatal Visit</label>
                                    <input type="date" name="firstVisitDate" value={formData.firstVisitDate} onChange={handleChange} />
                                </div>

                                <div className="form-group">
                                    <label>Assigned Midwife / Doctor</label>
                                    <input type="text" name="assignedMidwife" value={formData.assignedMidwife} readOnly />
                                </div>
                                <div className="form-group">
                                    <label>Assigned Barangay Health Worker</label>
                                    <input type="text" name="bhwAssigned" value={formData.bhwAssigned} readOnly />
                                </div>
                            </div>

                            <hr className="divider" />
                            <h3 className="section-subtitle">Initial Vital Signs</h3>
                            <div className="form-grid-3">
                                <div className="form-group">
                                    <label>Blood Pressure (mmHg) <span className="req">*</span></label>
                                    <input type="text" name="bp" placeholder="e.g. 120/80" value={formData.bp} onChange={handleChange} className={missingFields.includes('bp') ? 'error-field' : ''} />
                                </div>
                                <div className="form-group">
                                    <label>Weight (kg) <span className="req">*</span></label>
                                    <input type="number" name="weight" step="0.1" value={formData.weight} onChange={handleChange} className={missingFields.includes('weight') ? 'error-field' : ''} />
                                </div>
                                <div className="form-group">
                                    <label>Height (cm) <span className="req">*</span></label>
                                    <input type="number" name="height" value={formData.height} onChange={handleChange} className={missingFields.includes('height') ? 'error-field' : ''} />
                                </div>
                                <div className="form-group">
                                    <label>Fetal Heart Rate (bpm)</label>
                                    <input type="number" name="fhr" value={formData.fhr} onChange={handleChange} />
                                </div>
                                <div className="form-group">
                                    <label>Hemoglobin Level (g/dL)</label>
                                    <input type="number" name="hgb" step="0.1" value={formData.hgb} onChange={handleChange} />
                                </div>
                            </div>

                            <hr className="divider" />
                            <h3 className="section-subtitle">Emergency Contact Details</h3>
                            <div className="form-grid-2">
                                <div className="form-group">
                                    <label>Contact Person Name <span className="req">*</span></label>
                                    <input type="text" name="emName" value={formData.emName} onChange={handleChange} required className={missingFields.includes('emName') ? 'error-field' : ''} />
                                </div>
                                <div className="form-group">
                                    <label>Relationship to Patient <span className="req">*</span></label>
                                    <select name="emRel" value={formData.emRel} onChange={handleChange} required className={missingFields.includes('emRel') ? 'error-field' : ''}>
                                        <option value="" disabled>Select Relationship</option>
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
                                    <input type="tel" name="emPhone" value={formData.emPhone} onChange={handleChange} required className={missingFields.includes('emPhone') || missingFields.includes('emPhone-invalid') ? 'error-field' : ''} />
                                    {missingFields.includes('emPhone-invalid') && <span className="field-error-msg" style={{color: 'var(--color-rose)', fontSize: '11px', marginTop: '4px', display: 'block'}}>Phone number must be exactly 11 digits</span>}
                                </div>
                                <div className="form-group">
                                    <label>Address <span className="req">*</span></label>
                                    <input type="text" name="emAddress" value={formData.emAddress} onChange={handleChange} required className={missingFields.includes('emAddress') ? 'error-field' : ''} />
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
                                <h3>Click to upload or drag and drop</h3>
                                <p>SVG, PNG, JPG or PDF (max. 5MB)</p>
                                <button type="button" className="btn btn-outline mt-3">Browse Files</button>
                            </div>

                            <div className="document-list">
                                {/* Placeholder for uploaded documents list. In real implementation, this would map over uploaded files. 
                                wala muna nakalagay
                                */}
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