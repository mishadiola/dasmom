import React, { useState, useEffect } from 'react';
import supabase from '../config/supabaseclient';
import PatientService from '../services/patientservice';
import VaccinationService from '../services/vaccinationservice';
import { X, Syringe, CheckCircle2, RefreshCw } from 'lucide-react';
import { useModal } from '../context/ModalContext';

const NewbornVaccinationModal = ({ newborn, onClose, onSave }) => {
    const { alert: customAlert } = useModal();
    const [pendingVaccines, setPendingVaccines] = useState([]);
    const [selectedVaccines, setSelectedVaccines] = useState({});
    const [staff, setStaff] = useState('');
    const [staffList, setStaffList] = useState([]);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [remarks, setRemarks] = useState('');
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            if (!newborn?.id) return;

            const { data: motherData, error: motherError } = await supabase
                .from('newborns')
                .select('mother_id, patient_basic_info!mother_id (station_ass, stations:station_ass (station_name))')
                .eq('id', newborn.id)
                .single();

            const station = motherData?.patient_basic_info?.stations?.station_name;
            if (station) {
                const { data: staffData, error: staffError } = await supabase
                    .from('staff_profiles')
                    .select('full_name, station_ass, stations:station_ass (station_name)')
                    .ilike('stations.station_name', `%${station}%`);

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
                    vaccine: v.notes?.trim() || v.vaccine_inventory?.vaccine_name || 'Scheduled vaccination',
                    notes: v.notes,
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
            await customAlert({ title: 'No Selection', text: 'Please select at least one vaccine to mark as administered.', iconType: 'warning' });
            return;
        }

        setIsSaving(true);
        try {
            const patientService = new PatientService();
            const currentUser = await patientService.getCurrentUserId();
            if (!currentUser) throw new Error('No logged-in user');
            const vaccinationService = new VaccinationService();
            const performingStationId = await vaccinationService.getCurrentUserStationId();
            if (!performingStationId) throw new Error('Your account must have an assigned service station.');
            const assignedStaff = await vaccinationService.getAssignedStaffForNewborn(newborn.id);

            for (const vaccId of selectedIds) {
                // Get the vaccine record to find the vaccine name
                const { data: vaccRecord, error: recordError } = await supabase
                    .from('vaccinations')
                    .select('id, vaccine_inventory_id, notes, vaccine_inventory(vaccine_name)')
                    .eq('id', vaccId)
                    .single();
                if (recordError) throw recordError;

                const vaccineMatch = vaccRecord?.notes?.match(/(?:\d+)(?:st|nd|rd|th) dose of (.+)/);
                const notes = String(vaccRecord?.notes || '').toLowerCase();
                const scheduledName = vaccineMatch?.[1]?.trim() || (
                    /tetanus|tdap|\btd\b/.test(notes) ? 'Tetanus Diphtheria (TD)' :
                    /influenza|\bflu\b/.test(notes) ? 'Influenza Vaccine' : null
                );
                const vaccineName = vaccRecord?.vaccine_inventory?.vaccine_name || scheduledName;
                const isVitaminASupplement = /^vitamin a$/i.test(scheduledName || vaccineName || '');
                const inventoryItem = vaccineName
                    ? await vaccinationService.resolveInventoryItem({
                        itemType: isVitaminASupplement ? 'supplement' : 'vaccine',
                        itemName: vaccineName,
                        stationId: performingStationId
                    })
                    : null;
                if (!inventoryItem) {
                    throw new Error(
                        isVitaminASupplement
                            ? 'Vitamin A is not available in your assigned station inventory.'
                            : 'This vaccine is not available in your assigned station inventory.'
                    );
                }

                // Update the vaccination record with date, status, and vaccine_inventory_id
                const updateData = { 
                    vaccinated_date: date, 
                    status: 'Completed', 
                    created_by: currentUser,
                    vaccinated_by: currentUser,
                    station_ass: performingStationId,
                    assigned_staff: assignedStaff,
                    remarks: remarks || null,
                    vaccine_inventory_id: isVitaminASupplement ? null : inventoryItem.id
                };
                
                const { error: updateError } = await supabase
                    .from('vaccinations')
                    .update(updateData)
                    .eq('id', vaccId);

                if (updateError) throw updateError;

                await vaccinationService.decrementStationInventory({
                    itemType: isVitaminASupplement ? 'supplement' : 'vaccine',
                    inventoryItem,
                    stationId: performingStationId
                });
            }

            if (onSave) onSave();
            onClose();
        } catch (error) {
            console.error('Error saving vaccinations:', error);
            await customAlert({ title: 'Error', text: 'Failed to save vaccinations: ' + error.message, iconType: 'danger' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="vacc-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div>
                        <h2><Syringe size={20} /> Mark Scheduled Doses as Attended</h2>
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
                                                {v.notes && <div className="vaccine-notes-hint" style={{ fontSize: '0.8rem', color: '#666' }}>{v.notes}</div>}
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
                            <div className="form-group">
                                <label>Remarks</label>
                                <textarea 
                                    placeholder="Doctor's observations or remarks..." 
                                    value={remarks} 
                                    onChange={e => setRemarks(e.target.value)} 
                                    rows="2"
                                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                                />
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
