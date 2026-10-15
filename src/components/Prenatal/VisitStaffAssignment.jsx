import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { UserRoundPlus, Edit2, X, Check } from 'lucide-react';
import PatientService from '../../services/patientservice';
import ActionTooltip from '../Common/ActionTooltip';
import '../Patient/PatientStaffAssignment.css';
import './VisitStaffAssignment.css';

const VisitStaffAssignment = ({
  visitId,
  visitStationId,
  assignedStaffId,
  assignedStaffName,
  assignedStationName,
  visitStationName,
  visitStatus,
  userRole,
  userStationId,
  onAssigned
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [staffOptions, setStaffOptions] = useState([]);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const roleLabel = String(userRole || '').toLowerCase().replace(/_/g, ' ').trim();
  const normalizedRole = roleLabel === 'station staff' ? 'staff' : roleLabel;

  // Permissions matching DASMOM+ station access rules:
  // - Admin can assign/reassign any scheduled visit
  // - CHO Personnel can assign/reassign scheduled visits for any station (or their station)
  // - Staff can assign/reassign if the visit station or assignment matches their station
  const isScheduled = visitStatus === 'Scheduled';
  const canAssign = isScheduled && (
    normalizedRole === 'admin' ||
    normalizedRole === 'cho personnel' ||
    (normalizedRole === 'staff' && (
      (!visitStationId && !userStationId) ||
      visitStationId === userStationId ||
      !assignedStaffId
    ))
  );

  const canEdit = canAssign && Boolean(assignedStaffId);

  const openAssignment = async (event) => {
    event.stopPropagation();
    setIsOpen(true);
    setError('');
    setSelectedStaffId(assignedStaffId || '');

    setLoadingOptions(true);
    try {
      const service = new PatientService();
      // Load staff assignable to the visit's station (or user's station / all if admin)
      const targetStationId = visitStationId || (normalizedRole === 'staff' ? userStationId : null);
      
      let options = [];
      if (normalizedRole === 'admin' || !targetStationId) {
        const { data, error: staffError } = await service.supabase
          .from('staff_profiles')
          .select('id, full_name, station_ass')
          .order('full_name');
        if (staffError) throw staffError;
        options = data || [];
      } else {
        options = await service.getAssignableStaffByStationId(targetStationId);
        // If assigned staff is from another station, ensure they appear in the options
        if (assignedStaffId && !options.some(s => s.id === assignedStaffId)) {
          const { data: currentStaff } = await service.supabase
            .from('staff_profiles')
            .select('id, full_name, station_ass')
            .eq('id', assignedStaffId)
            .single();
          if (currentStaff) {
            options = [currentStaff, ...options];
          }
        }
      }

      setStaffOptions(options);
      if (options.length === 0) {
        setError('No assignable healthcare workers found for this station.');
      }
    } catch (err) {
      console.error('Error loading visit assignable staff:', err);
      setError(err.message || 'Could not load healthcare workers.');
    } finally {
      setLoadingOptions(false);
    }
  };

  const closeAssignment = (event) => {
    if (event) event.stopPropagation();
    setIsOpen(false);
    setError('');
  };

  const saveAssignment = async (event) => {
    event.stopPropagation();
    setSaving(true);
    setError('');
    try {
      const service = new PatientService();
      // Reassign visit without modifying the patient's registered station
      await service.reassignPrenatalVisit(visitId, selectedStaffId || null);

      const chosenStaff = staffOptions.find(o => o.id === selectedStaffId);
      const newName = chosenStaff ? chosenStaff.full_name : null;

      onAssigned?.({
        visitId,
        assignedStaffId: selectedStaffId || null,
        assignedStaffName: newName
      });

      setIsOpen(false);
    } catch (err) {
      console.error('Error saving visit assignment:', err);
      setError(err.message || 'Could not save assignment.');
    } finally {
      setSaving(false);
    }
  };

  const stationLabel = assignedStationName || visitStationName;

  return (
    <div className="visit-staff-assignment" onClick={event => event.stopPropagation()}>
      {assignedStaffId ? (
        <div className="visit-staff-assignment__assigned-wrapper">
          <span className="visit-staff-assignment__name" title={assignedStaffName}>
            {assignedStaffName || 'Assigned Staff'}
          </span>
          {canEdit && (
            <ActionTooltip text="Reassign Healthcare Worker">
              <button
                type="button"
                className="visit-staff-assignment__edit-btn"
                onClick={openAssignment}
                aria-label="Reassign healthcare worker"
              >
                <Edit2 size={12} />
              </button>
            </ActionTooltip>
          )}
        </div>
      ) : canAssign ? (
        <ActionTooltip text="Assign Healthcare Worker" align="left">
          <button
            type="button"
            className="patient-staff-assignment__button visit-staff-assignment__btn"
            onClick={openAssignment}
            aria-label="Assign healthcare worker to this visit"
          >
            <UserRoundPlus size={14} /> Assign Healthcare Worker
          </button>
        </ActionTooltip>
      ) : (
        <span className="visit-staff-assignment__unassigned">Unassigned</span>
      )}

      {/* Station sub-label if present */}
      {stationLabel && (
        <span className="visit-staff-assignment__station">
          {assignedStationName || 'Unassigned'}
          {visitStationName && visitStationName !== assignedStationName ? ` · Visit: ${visitStationName}` : ''}
        </span>
      )}

      {/* Assignment Modal / Popover */}
      {isOpen && createPortal(
        <div className="vsa-modal-overlay" onClick={closeAssignment}>
          <div className="vsa-modal-card" onClick={e => e.stopPropagation()}>
            <div className="vsa-modal-header">
              <h4>Assign Healthcare Worker</h4>
              <button
                type="button"
                className="vsa-modal-close"
                onClick={closeAssignment}
                disabled={saving}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="vsa-modal-body">
              <p className="vsa-modal-subtitle">
                Select a healthcare worker to handle this specific visit.
              </p>

              <div className="vsa-select-wrap">
                <label htmlFor={`vsa-select-${visitId}`}>Healthcare Worker</label>
                <select
                  id={`vsa-select-${visitId}`}
                  value={selectedStaffId}
                  onChange={e => setSelectedStaffId(e.target.value)}
                  disabled={loadingOptions || saving}
                >
                  <option value="">
                    {loadingOptions ? 'Loading healthcare workers...' : 'Select healthcare worker (or unassign)'}
                  </option>
                  {staffOptions.map(staff => (
                    <option key={staff.id} value={staff.id}>
                      {staff.full_name}
                    </option>
                  ))}
                </select>
              </div>

              {error && (
                <div className="vsa-error" role="alert">
                  {error}
                </div>
              )}
            </div>

            <div className="vsa-modal-footer">
              <button
                type="button"
                className="vsa-btn-cancel"
                onClick={closeAssignment}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="vsa-btn-save"
                onClick={saveAssignment}
                disabled={loadingOptions || saving}
              >
                {saving ? 'Saving...' : 'Save Assignment'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default VisitStaffAssignment;
