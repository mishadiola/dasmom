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
                // Deduplicate vaccines by vaccine name and dose number
                const mappedVaccines = (pending || []).map(v => ({
                    id: v.id,
                    vaccine: v.vaccine_inventory?.vaccine_name || (v.notes ? v.notes.match(/(\d+)(?:st|nd|rd|th) dose of (.+)/)?.[2] : null) || 'Unknown Vaccine',
                    dose_number: v.dose_number,
                    scheduled_vaccination: v.scheduled_vaccination
                }));

                const uniqueVaccines = [];
                const seenKeys = new Set();

                for (const v of mappedVaccines) {
                    const key = `${v.vaccine}-${v.dose_number}`;
                    if (!seenKeys.has(key)) {
                        seenKeys.add(key);
                        uniqueVaccines.push(v);
                    }
                }

                setPendingVaccines(uniqueVaccines);
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
                // Get the vaccine record to find the vaccine name
                const { data: vaccRecord } = await supabase
                    .from('vaccinations')
                    .select('id, vaccine_inventory_id, notes')
                    .eq('id', vaccId)
                    .single();

                let vaccineInvId = vaccRecord?.vaccine_inventory_id;
                let vaccineName = null;

                // If no vaccine_inventory_id, try to find it from notes
                if (!vaccineInvId && vaccRecord?.notes) {
                    const vaccineMatch = vaccRecord.notes.match(/(\d+)(?:st|nd|rd|th) dose of (.+)/);
                    if (vaccineMatch) {
                        vaccineName = vaccineMatch[2].trim();
                        console.log('🔍 Extracted vaccine name from notes:', vaccineName);
                        
                        // Try to find the vaccine in inventory
                        const { data: vaccInv, error: invError } = await supabase
                            .from('vaccine_inventory')
                            .select('id, quantity, vaccine_name')
                            .or(`vaccine_name.ilike.%${vaccineName}%,vaccine_name.ilike.%${vaccineName.replace(/ \(.+\)/, '')}%`)
                            .limit(1);

                        if (vaccInv && vaccInv.length > 0) {
                            vaccineInvId = vaccInv[0].id;
                            vaccineName = vaccInv[0].vaccine_name;
                            console.log('✅ Found vaccine in inventory:', vaccineName, 'ID:', vaccineInvId);
                        }
                    }
                }

                // Update the vaccination record with date, status, and vaccine_inventory_id
                const updateData = { 
                    vaccinated_date: date, 
                    status: 'Completed', 
                    created_by: currentUser 
                };
                if (vaccineInvId) {
                    updateData.vaccine_inventory_id = vaccineInvId;
                }
                
                const { error: updateError } = await supabase
                    .from('vaccinations')
                    .update(updateData)
                    .eq('id', vaccId);

                if (updateError) {
                    console.error('❌ Error updating vaccination record:', updateError);
                } else {
                    console.log('✅ Updated vaccination record:', vaccId);
                }

                // Decrement vaccine inventory
                if (vaccineInvId) {
                    const { data: vaccInv } = await supabase
                        .from('vaccine_inventory')
                        .select('id, quantity, vaccine_name')
                        .eq('id', vaccineInvId)
                        .single();

                    if (vaccInv && vaccInv.quantity > 0) {
                        await supabase
                            .from('vaccine_inventory')
                            .update({ quantity: vaccInv.quantity - 1 })
                            .eq('id', vaccInv.id);
                        console.log(`✅ Decremented vaccine: ${vaccInv.vaccine_name} (${vaccInv.quantity} -> ${vaccInv.quantity - 1})`);
                    }
                } else if (vaccRecord?.notes) {
                    // Fallback: try to find by name in notes
                    const vaccineMatch = vaccRecord.notes.match(/(\d+)(?:st|nd|rd|th) dose of (.+)/);
                    if (vaccineMatch) {
                        const extractedName = vaccineMatch[2].trim();
                        const { data: vaccInv } = await supabase
                            .from('vaccine_inventory')
                            .select('id, quantity, vaccine_name')
                            .or(`vaccine_name.ilike.%${extractedName}%,vaccine_name.ilike.%${extractedName.replace(/ \(.+\)/, '')}%`)
                            .limit(1);

                        if (vaccInv && vaccInv.length > 0 && vaccInv[0].quantity > 0) {
                            await supabase
                                .from('vaccine_inventory')
                                .update({ quantity: vaccInv[0].quantity - 1 })
                                .eq('id', vaccInv[0].id);
                            console.log(`✅ Decremented vaccine (by name): ${vaccInv[0].vaccine_name}`);
                        }
                    }
                }
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
                            <div className="newborn-info-card">
                                <div className="info-row">
                                    <span className="info-label">Mother Name</span>
                                    <span className="info-value">{newborn?.motherName || 'N/A'}</span>
                                </div>
                                <div className="info-row">
                                    <span className="info-label">Station</span>
                                    <span className="info-value">{newborn?.station || 'N/A'}</span>
                                </div>
                                <div className="info-row">
                                    <span className="info-label">Birth Date</span>
                                    <span className="info-value">{newborn?.birthDate || 'N/A'}</span>
                                </div>
                            </div>
                            
                            <div className="vaccine-list-section">
                                <div className="section-header">
                                    <h3><Syringe size={16} /> Pending Scheduled Vaccines</h3>
                                    <p className="section-note">Check the vaccines that were administered today.</p>
                                </div>
                                <div className="vaccine-list">
                                    {pendingVaccines.map(v => (
                                        <label key={v.id} className="vaccine-item">
                                            <div className="vaccine-checkbox">
                                                <input
                                                    type="checkbox"
                                                    checked={!!selectedVaccines[v.id]}
                                                    onChange={() => setSelectedVaccines(prev => ({ ...prev, [v.id]: !prev[v.id] }))}
                                                />
                                            </div>
                                            <div className="vaccine-details">
                                                <span className="vaccine-name">{v.vaccine}</span>
                                                <span className="vaccine-dose">Dose {v.dose_number}</span>
                                            </div>
                                            <div className="vaccine-schedule">
                                                <span className="schedule-label">Scheduled</span>
                                                <span className="schedule-date">{v.scheduled_vaccination}</span>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            
                            <div className="form-group">
                                <label>Date Administered <span className="req">*</span></label>
                                <input type="date" value={date} onChange={e => setDate(e.target.value)} />
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
