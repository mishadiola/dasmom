import React, { useState, useEffect } from 'react';
import supabase from '../config/supabaseclient';
import PatientService from '../services/patientservice';
import { X, Syringe, CheckCircle2, RefreshCw } from 'lucide-react';

const NewbornVaccinationModal = ({ newborn, onClose, onSave }) => {
    const [pendingVaccines, setPendingVaccines] = useState([]);
    const [selectedVaccines, setSelectedVaccines] = useState({});
    const [staff, setStaff] = useState('');
    const [staffList, setStaffList] = useState([]);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            if (!newborn?.id) return;

            const { data: motherData, error: motherError } = await supabase
                .from('newborns')
                .select('mother_id, patient_basic_info!mother_id (barangay)')
                .eq('id', newborn.id)
                .single();

            const barangay = motherData?.patient_basic_info?.barangay;
            if (barangay) {
                const { data: staffData, error: staffError } = await supabase
                    .from('staff_profiles')
                    .select('full_name')
                    .eq('barangay_assignment', barangay);

                const staffOptions = staffData ? staffData.map(s => s.full_name) : [];
                setStaffList(staffOptions);
                if (staffOptions.length > 0) setStaff(staffOptions[0]);
            } else {
                setStaffList([]);
            }

            const { data: pending, error } = await supabase
                .from('vaccinations')
                .select(`id, dose_number, scheduled_vaccination, vaccine_inventory (vaccine_name), notes`)
                .eq('newborn_id', newborn.id)
                .eq('status', 'Pending')
                .order('scheduled_vaccination', { ascending: true });

            if (error) {
                console.error('Error fetching pending vaccines:', error);
                setPendingVaccines([]);
            } else {
                setPendingVaccines((pending || []).map(v => ({
                    id: v.id,
                    vaccine: v.vaccine_inventory?.vaccine_name || (v.notes ? v.notes.match(/(\d+)(?:st|nd|rd|th) dose of (.+)/)?.[2] : null) || 'Unknown Vaccine',
                    dose_number: v.dose_number,
                    scheduled_vaccination: v.scheduled_vaccination
                })));
            }

            setLoading(false);
        };

        fetchData();
    }, [newborn?.id]);

    const handleSave = async () => {
        const selectedIds = Object.entries(selectedVaccines)
            .filter(([, checked]) => checked)
            .map(([id]) => id);

        if (selectedIds.length === 0) {
            alert('Please select at least one vaccine to mark as administered.');
            return;
        }

        setIsSaving(true);
        try {
            const patientService = new PatientService();
            const currentUser = await patientService.getCurrentUserId();
            if (!currentUser) throw new Error('No logged-in user');

            for (const vaccId of selectedIds) {
                await supabase
                    .from('vaccinations')
                    .update({ vaccinated_date: date, status: 'Completed', created_by: currentUser })
                    .eq('id', vaccId);
            }

            if (onSave) onSave();
            onClose();
        } catch (error) {
            console.error('Error saving vaccinations:', error);
            alert('Failed to save vaccinations: ' + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="vacc-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div>
                        <h2><Syringe size={20} /> Mark Vaccines as Attended</h2>
                        <p>{newborn?.babyName || 'Newborn'}</p>
                    </div>
                    <button className="modal-close" onClick={onClose}><X size={20} /></button>
                </div>
                <div className="modal-body">
                    {loading ? (
                        <p>Loading pending vaccinations...</p>
                    ) : pendingVaccines.length === 0 ? (
                        <p>No pending vaccinations for this newborn.</p>
                    ) : (
                        <>
                            <div className="form-grid-2">
                                <div className="form-group">
                                    <label>Mother Name</label>
                                    <input type="text" value={newborn?.motherName || ''} readOnly />
                                </div>
                                <div className="form-group">
                                    <label>Station</label>
                                    <input type="text" value={newborn?.station || ''} readOnly />
                                </div>
                            </div>
                            <div className="pending-vaccines-section">
                                <h3>Pending Scheduled Vaccines</h3>
                                <p className="pending-vaccines-note">Check the vaccines that were administered today.</p>
                                {pendingVaccines.map(v => (
                                    <label key={v.id} className="pending-vaccine-item">
                                        <input
                                            type="checkbox"
                                            checked={!!selectedVaccines[v.id]}
                                            onChange={() => setSelectedVaccines(prev => ({ ...prev, [v.id]: !prev[v.id] }))}
                                        />
                                        {v.vaccine} (Dose {v.dose_number}) — Scheduled: {v.scheduled_vaccination}
                                    </label>
                                ))}
                            </div>
                            <div className="form-grid-2">
                                <div className="form-group">
                                    <label>Date Administered <span className="req">*</span></label>
                                    <input type="date" value={date} onChange={e => setDate(e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label>Administered By <span className="req">*</span></label>
                                    <select value={staff} onChange={e => setStaff(e.target.value)}>
                                        {staffList.map(s => <option key={s}>{s}</option>)}
                                    </select>
                                </div>
                            </div>
                        </>
                    )}
                </div>
                <div className="modal-footer">
                    <button className="btn btn-outline" onClick={onClose} disabled={isSaving}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={isSaving || loading || pendingVaccines.length === 0}>
                        {isSaving ? <RefreshCw size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                        {isSaving ? 'Saving...' : 'Confirm & Save'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NewbornVaccinationModal;
