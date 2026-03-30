import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Save, X, FileText, User, Activity,
    Calendar, HeartPulse, UploadCloud, AlertTriangle,
    CheckCircle2, XCircle, Loader2
} from 'lucide-react';
import "../../styles/pages/AddPatient.css";
import PatientService from "../../services/patientservice"; // make sure this matches your file name exactly

const TABS = [
    { id: "personal", label: "Personal", icon: User },
    { id: "pregnancy", label: "Pregnancy", icon: HeartPulse },
    { id: "medical", label: "Medical", icon: Activity },
    { id: "prenatal", label: "Prenatal", icon: Calendar },
    { id: "documents", label: "Documents", icon: FileText },
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
        firstVisitDate: '', assignedMidwife: '', healthFacility: '',
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
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setIsSaving(true);

        const missingPersonal = !formData.firstName || !formData.lastName || !formData.dob || !formData.email || !formData.contactNumber;
        const missingEmergency = !formData.emName || !formData.emRel || !formData.emPhone || !formData.emAddress;

        if (missingPersonal || missingEmergency) {
            setToast({ type: 'error', message: 'Please fill in all required fields (Name, Date of Birth, Email, Phone, Emergency).' });
            setTimeout(() => setToast(null), 3000);
            setActiveTab(missingPersonal ? 'personal' : 'prenatal');
            setIsSaving(false);
            return;
        }

        try {
            const newId = await PatientService.addPatient(formData); 
            setToast({ type: 'success', message: `Patient successfully saved! ID: ${newId}` });

            setTimeout(() => {
                if (window.confirm("Do you want to schedule the first prenatal visit?")) {
                    navigate('/dashboard/prenatal');
                } 
                else {
                    navigate(`/dashboard/patients/${newId}`);
                }
            }, 1500);
        } catch (error) {
            console.error(error);
            setToast({ type: 'error', message: 'Failed to save patient. Please try again.' });
        } finally {
            setIsSaving(false);
        }
    };
//front end
    return (
        <div className="add-patient-page">
            {/* Toast Notification */}
            {toast && (
                <div className={`toast toast--${toast.type}`}>
                    {toast.type === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />} {toast.message}
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
                    {/* ...all your existing tab content stays the same as you pasted... */}
                </form>
            </div>
        </div>
    );
};

export default AddPatient;