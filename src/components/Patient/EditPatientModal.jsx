import React, { useState, useEffect } from 'react';
import { X, User, Phone, MapPin, Shield, Save, AlertCircle } from 'lucide-react';
import PatientService from '../../services/patientservice';
import './EditPatientModal.css';

const EditPatientModal = ({ patient, onClose, onSave }) => {
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        dateOfBirth: '',
        age: '',
        civilStatus: '',
        bloodType: '',
        philhealth: '',
        phone: '',
        address: '',
        station: '',
        municipality: '',
        emergencyContactName: '',
        emergencyContactRelationship: '',
        emergencyContactPhone: ''
    });
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const calculateAge = (dob) => {
        if (!dob) return '';
        const birth = new Date(dob);
        if (Number.isNaN(birth.getTime())) return '';
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
            age -= 1;
        }
        return age >= 0 ? age.toString() : '';
    };

    useEffect(() => {
        if (patient) {
            // Split full name into first and last name
            const nameParts = patient.name ? patient.name.split(' ') : ['', ''];
            const firstName = nameParts[0] || '';
            const lastName = nameParts.slice(1).join(' ') || '';

            setFormData({
                firstName: firstName,
                lastName: lastName,
                dateOfBirth: patient.dob || '',
                age: patient.age || calculateAge(patient.dob),
                civilStatus: patient.civilStatus || '',
                bloodType: patient.bloodType || '',
                philhealth: patient.philhealth || '',
                phone: patient.phone || '',
                address: patient.address || '',
                station: patient.station || '',
                municipality: patient.municipality || '',
                emergencyContactName: patient.emergencyContact?.name || '',
                emergencyContactRelationship: patient.emergencyContact?.relationship || '',
                emergencyContactPhone: patient.emergencyContact?.phone || ''
            });
        }
    }, [patient]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const nextState = {
                ...prev,
                [name]: value
            };
            if (name === 'dateOfBirth') {
                nextState.age = calculateAge(value);
            }
            return nextState;
        });
        // Clear error when user starts typing
        if (errors[name]) {
            setErrors(prev => ({
                ...prev,
                [name]: ''
            }));
        }
    };

    const validateForm = () => {
        const newErrors = {};

        if (!formData.firstName.trim()) {
            newErrors.firstName = 'First name is required';
        }
        if (!formData.lastName.trim()) {
            newErrors.lastName = 'Last name is required';
        }
        if (!formData.dateOfBirth) {
            newErrors.dateOfBirth = 'Date of birth is required';
        }
        if (!formData.phone.trim()) {
            newErrors.phone = 'Phone number is required';
        }
        if (!formData.address.trim()) {
            newErrors.address = 'Address is required';
        }
        if (!formData.station.trim()) {
            newErrors.station = 'Station is required';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!validateForm()) {
            return;
        }

        setLoading(true);
        setSuccess(false);

        try {
            const patientService = new PatientService();
            
            const updatedData = {
                first_name: formData.firstName,
                last_name: formData.lastName,
                date_of_birth: formData.dateOfBirth,
                civil_status: formData.civilStatus,
                bloodtype: formData.bloodType,
                philhealth: formData.philhealth,
                phone: formData.phone,
                address: formData.address,
                station: formData.station,
                municipality: formData.municipality,
                emergency_contact_name: formData.emergencyContactName,
                emergency_contact_relationship: formData.emergencyContactRelationship,
                emergency_contact_phone: formData.emergencyContactPhone
            };

            await patientService.updatePatient(patient.id, updatedData);
            
            setSuccess(true);
            
            // Call the onSave callback to update the parent component
            if (onSave) {
                onSave({
                    ...patient,
                    name: `${formData.firstName} ${formData.lastName}`,
                    dob: formData.dateOfBirth,
                    age: calculateAge(formData.dateOfBirth),
                    civilStatus: formData.civilStatus,
                    bloodType: formData.bloodType,
                    philhealth: formData.philhealth,
                    phone: formData.phone,
                    address: formData.address,
                    station: formData.station,
                    municipality: formData.municipality,
                    emergencyContact: {
                        name: formData.emergencyContactName,
                        relationship: formData.emergencyContactRelationship,
                        phone: formData.emergencyContactPhone
                    }
                });
            }

            setTimeout(() => {
                onClose();
            }, 1500);

        } catch (error) {
            console.error('Error updating patient:', error);
            setErrors({ submit: 'Failed to update patient. Please try again.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="edit-patient-modal-overlay" onClick={onClose}>
            <div className="edit-patient-modal" onClick={e => e.stopPropagation()}>
                <div className="edit-patient-modal-header">
                    <div className="edit-patient-modal-title">
                        <User size={20} />
                        <h2>Edit Patient Information</h2>
                    </div>
                    <button className="edit-patient-modal-close" onClick={onClose}>
                        <X size={18} />
                    </button>
                </div>

                {success ? (
                    <div className="edit-patient-success">
                        <div className="success-icon">
                            <Save size={32} />
                        </div>
                        <h3>Patient Updated Successfully!</h3>
                        <p>The patient information has been saved to the database.</p>
                    </div>
                ) : (
                    <form className="edit-patient-modal-body" onSubmit={handleSubmit}>
                        {errors.submit && (
                            <div className="edit-patient-error">
                                <AlertCircle size={16} />
                                {errors.submit}
                            </div>
                        )}

                        {/* Personal Information */}
                        <div className="edit-patient-section">
                            <h3 className="edit-patient-section-title">
                                <User size={16} /> Personal Information
                            </h3>
                            <div className="edit-patient-grid">
                                <div className="form-group">
                                    <label>First Name *</label>
                                    <input
                                        type="text"
                                        name="firstName"
                                        value={formData.firstName}
                                        onChange={handleChange}
                                        className={errors.firstName ? 'error' : ''}
                                    />
                                    {errors.firstName && <span className="error-text">{errors.firstName}</span>}
                                </div>
                                <div className="form-group">
                                    <label>Last Name *</label>
                                    <input
                                        type="text"
                                        name="lastName"
                                        value={formData.lastName}
                                        onChange={handleChange}
                                        className={errors.lastName ? 'error' : ''}
                                    />
                                    {errors.lastName && <span className="error-text">{errors.lastName}</span>}
                                </div>
                                <div className="form-group">
                                    <label>Date of Birth *</label>
                                    <input
                                        type="date"
                                        name="dateOfBirth"
                                        value={formData.dateOfBirth}
                                        onChange={handleChange}
                                        className={errors.dateOfBirth ? 'error' : ''}
                                    />
                                    {errors.dateOfBirth && <span className="error-text">{errors.dateOfBirth}</span>}
                                </div>
                                <div className="form-group">
                                    <label>Age</label>
                                    <input
                                        type="number"
                                        name="age"
                                        value={formData.age}
                                        readOnly
                                        min="0"
                                        max="120"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Civil Status</label>
                                    <select
                                        name="civilStatus"
                                        value={formData.civilStatus}
                                        onChange={handleChange}
                                    >
                                        <option value="">Select</option>
                                        <option value="Single">Single</option>
                                        <option value="Married">Married</option>
                                        <option value="Widowed">Widowed</option>
                                        <option value="Separated">Separated</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Blood Type</label>
                                    <select
                                        name="bloodType"
                                        value={formData.bloodType}
                                        onChange={handleChange}
                                    >
                                        <option value="">Select</option>
                                        <option value="A+">A+</option>
                                        <option value="A-">A-</option>
                                        <option value="B+">B+</option>
                                        <option value="B-">B-</option>
                                        <option value="AB+">AB+</option>
                                        <option value="AB-">AB-</option>
                                        <option value="O+">O+</option>
                                        <option value="O-">O-</option>
                                    </select>
                                </div>
                                <div className="form-group full-width">
                                    <label>PhilHealth Number</label>
                                    <input
                                        type="text"
                                        name="philhealth"
                                        value={formData.philhealth}
                                        onChange={handleChange}
                                        placeholder="Enter PhilHealth number"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Contact Information */}
                        <div className="edit-patient-section">
                            <h3 className="edit-patient-section-title">
                                <Phone size={16} /> Contact Information
                            </h3>
                            <div className="edit-patient-grid">
                                <div className="form-group full-width">
                                    <label>Phone Number *</label>
                                    <input
                                        type="tel"
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleChange}
                                        placeholder="e.g., 09123456789"
                                        className={errors.phone ? 'error' : ''}
                                    />
                                    {errors.phone && <span className="error-text">{errors.phone}</span>}
                                </div>
                                <div className="form-group full-width">
                                    <label>Address *</label>
                                    <input
                                        type="text"
                                        name="address"
                                        value={formData.address}
                                        onChange={handleChange}
                                        placeholder="Street address"
                                        className={errors.address ? 'error' : ''}
                                    />
                                    {errors.address && <span className="error-text">{errors.address}</span>}
                                </div>
                                <div className="form-group">
                                    <label>Station *</label>
                                    <input
                                        type="text"
                                        name="station"
                                        value={formData.station}
                                        onChange={handleChange}
                                        placeholder="Barangay"
                                        className={errors.station ? 'error' : ''}
                                    />
                                    {errors.station && <span className="error-text">{errors.station}</span>}
                                </div>
                                <div className="form-group">
                                    <label>Municipality</label>
                                    <input
                                        type="text"
                                        name="municipality"
                                        value={formData.municipality}
                                        onChange={handleChange}
                                        placeholder="City/Municipality"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Emergency Contact */}
                        <div className="edit-patient-section">
                            <h3 className="edit-patient-section-title">
                                <Shield size={16} /> Emergency Contact
                            </h3>
                            <div className="edit-patient-grid">
                                <div className="form-group">
                                    <label>Contact Name</label>
                                    <input
                                        type="text"
                                        name="emergencyContactName"
                                        value={formData.emergencyContactName}
                                        onChange={handleChange}
                                        placeholder="Full name"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Relationship</label>
                                    <input
                                        type="text"
                                        name="emergencyContactRelationship"
                                        value={formData.emergencyContactRelationship}
                                        onChange={handleChange}
                                        placeholder="e.g., Spouse, Parent"
                                    />
                                </div>
                                <div className="form-group full-width">
                                    <label>Phone Number</label>
                                    <input
                                        type="tel"
                                        name="emergencyContactPhone"
                                        value={formData.emergencyContactPhone}
                                        onChange={handleChange}
                                        placeholder="Contact phone number"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="edit-patient-modal-footer">
                            <button type="button" className="btn btn-secondary" onClick={onClose}>
                                Cancel
                            </button>
                            <button type="submit" className="btn btn-primary" disabled={loading}>
                                {loading ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default EditPatientModal;
