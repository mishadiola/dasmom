import React, { useState } from 'react';
import { UserRoundPlus } from 'lucide-react';
import PatientService from '../../services/patientservice';
import ActionTooltip from '../Common/ActionTooltip';
import { useRolePermissions } from '../../context/RolePermissionContext';
import './PatientStaffAssignment.css';

const PatientStaffAssignment = ({
  patientId,
  patientStationId,
  assignedStaffId,
  assignedStaffName,
  viewerStationId,
  onAssigned
}) => {
  const { hasPermission, loading: permissionsLoading } = useRolePermissions();
  const [isOpen, setIsOpen] = useState(false);
  const [staffOptions, setStaffOptions] = useState([]);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const assignmentPermission = patientStationId === viewerStationId
    ? 'patient.assign_staff.own_station'
    : 'patient.assign_staff.other_station';
  const canAssign = !permissionsLoading
    && Boolean(patientStationId)
    && hasPermission(assignmentPermission)
    && !assignedStaffId;

  const openAssignment = async (event) => {
    event.stopPropagation();
    setIsOpen(true);
    setError('');
    if (staffOptions.length || loadingOptions) return;

    setLoadingOptions(true);
    try {
      const service = new PatientService();
      const options = await service.getAssignableStaffByStationId(patientStationId);
      setStaffOptions(options);
      if (options.length === 0) setError('No assignable staff were found at this station.');
    } catch (loadError) {
      setError(loadError.message || 'Could not load station staff.');
    } finally {
      setLoadingOptions(false);
    }
  };

  const saveAssignment = async (event) => {
    event.stopPropagation();
    if (!selectedStaffId) return;

    setSaving(true);
    setError('');
    try {
      const service = new PatientService();
      await service.assignPatientPrenatalStaff(patientId, selectedStaffId);
      const staff = staffOptions.find(option => option.id === selectedStaffId);
      onAssigned?.({
        id: selectedStaffId,
        name: staff?.full_name || 'Assigned staff'
      });
      setIsOpen(false);
    } catch (saveError) {
      setError(saveError.message || 'Could not assign this patient.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="patient-staff-assignment" onClick={event => event.stopPropagation()}>
      {assignedStaffId ? (
        <span className="patient-staff-assignment__assigned">
          {assignedStaffName || 'Assigned'}
        </span>
      ) : canAssign ? (
        <>
          {!isOpen ? (
            <ActionTooltip text="Assign Healthcare Worker" align="left">
              <button type="button" className="patient-staff-assignment__button" onClick={openAssignment}>
                <UserRoundPlus size={14} /> Assign Healthcare Worker
              </button>
            </ActionTooltip>
          ) : (
            <div className="patient-staff-assignment__form">
              <select
                aria-label="Select staff from this station"
                value={selectedStaffId}
                onChange={event => setSelectedStaffId(event.target.value)}
                disabled={loadingOptions || saving}
              >
                <option value="">{loadingOptions ? 'Loading staff...' : 'Select station staff'}</option>
                {staffOptions.map(staff => (
                  <option key={staff.id} value={staff.id}>{staff.full_name}</option>
                ))}
              </select>
              <button type="button" onClick={saveAssignment} disabled={!selectedStaffId || saving}>
                {saving ? 'Saving...' : 'Assign'}
              </button>
              <button type="button" className="patient-staff-assignment__cancel" onClick={() => setIsOpen(false)} disabled={saving}>
                Cancel
              </button>
            </div>
          )}
          {error && <span className="patient-staff-assignment__error" role="alert">{error}</span>}
        </>
      ) : (
        <span className="patient-staff-assignment__unassigned">Unassigned</span>
      )}
    </div>
  );
};

export default PatientStaffAssignment;