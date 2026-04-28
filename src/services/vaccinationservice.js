import supabase from '../config/supabaseclient';
import AuthService from './authservice';

class VaccinationService {
  constructor() {
    this.authService = new AuthService();
    this.supabase = supabase;
  }

  async getCurrentUserId() {
    const user = await this.authService.getAuthUser();
    return user?.id || null;
  }

  /**
   * Calculate the scheduled date for a vaccine based on birth date and months offset
   */
  computeScheduledDate = (birthDate, monthsOffset) => {
    const target = new Date(birthDate);
    const wholeMonths = Math.floor(monthsOffset);
    target.setMonth(target.getMonth() + wholeMonths);
    const halfMonth = monthsOffset - wholeMonths;
    if (halfMonth === 0.5) {
      target.setDate(target.getDate() + 15);
    }
    return target;
  };

  /**
   * Automatically schedule vaccinations for newborn based on birth date
   * Creates records with vaccine_inventory_id = NULL (filled in when vaccine is actually given)
   */
  async scheduleNewbornVaccinations(newbornId, birthDate, createdBy) {
    try {
      const vaccineSchedule = [
        // At Birth (0 months)
        { months: 0, vaccines: ['BCG Vaccine', 'Hepatitis B Vaccine'], doses: [1, 1] },

        // 1.5 months
        { months: 1.5, vaccines: [
            'Pentavalent Vaccine (DPT-Hep B-Hib)',
            'Oral Polio Vaccine (OPV)',
            'Pneumococcal Conjugate Vaccine (PCV)'
          ], doses: [1, 1, 1] },

        // 2.5 months
        { months: 2.5, vaccines: [
            'Pentavalent Vaccine (DPT-Hep B-Hib)',
            'Oral Polio Vaccine (OPV)',
            'Pneumococcal Conjugate Vaccine (PCV)'
          ], doses: [2, 2, 2] },

        // 3.5 months
        { months: 3.5, vaccines: [
            'Pentavalent Vaccine (DPT-Hep B-Hib)',
            'Oral Polio Vaccine (OPV)',
            'Inactivated Polio Vaccine (IPV)',
            'Pneumococcal Conjugate Vaccine (PCV)'
          ], doses: [3, 3, 1, 3] },

        // 9 months
        { months: 9, vaccines: [
            'Measles, Mumps, Rubella Vaccine (MMR)'
          ], doses: [1] },

        // 12 months (1 year)
        { months: 12, vaccines: [
            'Measles, Mumps, Rubella Vaccine (MMR)',
            'Inactivated Polio Vaccine (IPV)'
          ], doses: [2, 2] }
      ];

      const birthDateObj = new Date(birthDate);
      const inserts = [];

      for (const schedule of vaccineSchedule) {
        const scheduledDate = this.computeScheduledDate(birthDateObj, schedule.months);
        const dateStr = scheduledDate.toISOString().split('T')[0];

        for (let i = 0; i < schedule.vaccines.length; i++) {
          const vaccine = schedule.vaccines[i];
          const dose = schedule.doses[i];
          const doseOrdinal = dose === 1 ? '1st' : dose === 2 ? '2nd' : dose === 3 ? '3rd' : `${dose}th`;

          inserts.push({
            newborn_id: newbornId,
            vaccine_inventory_id: null, // NULL until vaccine is actually given
            dose_number: dose,
            scheduled_vaccination: dateStr,
            status: 'Pending',
            vaccinated_date: null,
            created_by: createdBy,
            notes: `${doseOrdinal} dose of ${vaccine}` // Store vaccine name in notes
          });
        }
      }

      const { error } = await this.supabase
        .from('vaccinations')
        .insert(inserts);

      if (error) throw error;
      console.log(`✅ Scheduled ${inserts.length} vaccines for newborn ${newbornId}`);
      return { success: true, count: inserts.length };
    } catch (error) {
      console.error('Error scheduling newborn vaccinations:', error);
      throw error;
    }
  }

  /**
   * Record a vaccine dose - fills in vaccine_inventory_id and marks as Completed
   * Also decrements the vaccine inventory quantity (using nearest expiration date)
   */
  async recordVaccine(patientId, patientType, vaccineData) {
    try {
      const currentUser = await this.getCurrentUserId();
      if (!currentUser) throw new Error('No logged-in user');

      const { vaccineId, vaccineName, doseNumber, date, staff, notes } = vaccineData;

      // Get vaccine inventory items with the same name, sorted by expiration date (nearest first)
      const { data: vaccInvItems, error: invError } = await this.supabase
        .from('vaccine_inventory')
        .select('id, quantity, expiration_date')
        .eq('vaccine_name', vaccineName)
        .gt('quantity', 0)
        .order('expiration_date', { ascending: true, nullsFirst: false });

      if (invError || !vaccInvItems || vaccInvItems.length === 0) {
        throw new Error('Vaccine not found in inventory or out of stock');
      }

      // Use the vaccine with the nearest expiration date
      const vaccInv = vaccInvItems[0];

      if (vaccineId) {
        // Update existing scheduled vaccine record
        const { error: updateError } = await this.supabase
          .from('vaccinations')
          .update({
            vaccine_inventory_id: vaccInv.id,
            vaccinated_date: date,
            status: 'Completed',
            created_by: currentUser,
            notes: notes || null
          })
          .eq('id', vaccineId);

        if (updateError) throw updateError;
      } else {
        // Create new vaccination record (for manual entries not in schedule)
        const fieldName = patientType === 'Mother' ? 'patient_id' : 'newborn_id';
        const payload = {
          [fieldName]: patientId,
          vaccine_inventory_id: vaccInv.id,
          dose_number: doseNumber,
          vaccinated_date: date,
          scheduled_vaccination: date,
          status: 'Completed',
          created_by: currentUser,
          notes: notes || null
        };

        const { error: insertError } = await this.supabase
          .from('vaccinations')
          .insert([payload]);

        if (insertError) throw insertError;
      }

      // Decrement vaccine inventory quantity
      const newQuantity = (vaccInv.quantity || 1) - 1;
      if (newQuantity >= 0) {
        const { error: updateInvError } = await this.supabase
          .from('vaccine_inventory')
          .update({ quantity: newQuantity })
          .eq('id', vaccInv.id);

        if (updateInvError) {
          console.error('Warning: Failed to update vaccine inventory quantity:', updateInvError);
        } else {
          console.log(`✅ Decremented vaccine inventory for ${vaccineName}: ${vaccInv.quantity} -> ${newQuantity}`);
        }
      }

      return { success: true };
    } catch (error) {
      console.error('Error recording vaccine:', error);
      throw error;
    }
  }

  /**
   * Get all pending (unrecorded) vaccines for a patient
   */
  async getPendingVaccinesForPatient(patientId, patientType) {
    try {
      const fieldName = patientType === 'Mother' ? 'patient_id' : 'newborn_id';
      const { data: vaccRecords, error } = await this.supabase
        .from('vaccinations')
        .select('id, vaccine_inventory_id, dose_number, scheduled_vaccination, status, notes')
        .eq(fieldName, patientId)
        .eq('status', 'Pending')
        .is('vaccine_inventory_id', null);

      if (error) throw error;
      return vaccRecords || [];
    } catch (error) {
      console.error('Error getting pending vaccines:', error);
      return [];
    }
  }

  /**
   * Get scheduled vaccines grouped by date for a patient
   */
  async getScheduledVaccinesByDate(patientId, patientType) {
    try {
      const fieldName = patientType === 'Mother' ? 'patient_id' : 'newborn_id';
      const { data: vaccRecords, error } = await this.supabase
        .from('vaccinations')
        .select('id, dose_number, scheduled_vaccination, status, vaccine_inventory_id, notes')
        .eq(fieldName, patientId)
        .order('scheduled_vaccination', { ascending: true });

      if (error) throw error;

      // Group by scheduled date
      const grouped = {};
      (vaccRecords || []).forEach(record => {
        const date = record.scheduled_vaccination;
        if (!grouped[date]) {
          grouped[date] = { date, unrecorded: 0, total: 0, records: [] };
        }
        grouped[date].total += 1;
        if (!record.vaccine_inventory_id && record.status === 'Pending') {
          grouped[date].unrecorded += 1;
        }
        grouped[date].records.push(record);
      });

      return grouped;
    } catch (error) {
      console.error('Error getting scheduled vaccines by date:', error);
      return {};
    }
  }

  /**
   * Get all vaccination records with detail
   */
  async getAllVaccinations() {
    try {
      const { data: vaccRecords, error } = await this.supabase
        .from('vaccinations')
        .select(`
          id,
          patient_id,
          newborn_id,
          vaccine_inventory_id,
          dose_number,
          status,
          vaccinated_date,
          scheduled_vaccination,
          notes,
          created_at,
          created_by,
          staff_profiles!vaccinations_created_by_fkey (full_name),
          vaccine_inventory (vaccine_name),
          patient_basic_info!vaccinations_patient_id_fkey (id, first_name, last_name, barangay, province),
          newborns!vaccinations_newborn_id_fkey (
            id, 
            baby_name, 
            mother_id, 
            patient_basic_info!mother_id (first_name, last_name, barangay, province)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (vaccRecords || []).map(record => {
        let patientName, station, type, patientId;
        if (record.patient_id) {
          patientName = `${record.patient_basic_info?.first_name || ''} ${record.patient_basic_info?.last_name || ''}`.trim();
          station = `${record.patient_basic_info?.barangay || 'N/A'}, ${record.patient_basic_info?.province || 'N/A'}`;
          type = 'Mother';
          patientId = record.patient_id;
        } else if (record.newborn_id) {
          const newbornRecord = Array.isArray(record.newborns) ? record.newborns[0] : record.newborns;
          const mother = Array.isArray(newbornRecord?.patient_basic_info) ? newbornRecord.patient_basic_info[0] : newbornRecord?.patient_basic_info;
          patientName = newbornRecord?.baby_name || 'Unknown Newborn';
          station = `${mother?.barangay || 'N/A'}, ${mother?.province || 'N/A'}`;
          type = 'Newborn';
          patientId = record.newborn_id;
        } else {
          patientName = 'Unknown';
          station = 'Unknown';
          type = 'Unknown';
          patientId = 'Unknown';
        }

        let vaccineName = record.vaccine_inventory?.vaccine_name || 'Unrecorded';
        let doseText = record.dose_number === 1 ? '1st' : record.dose_number === 2 ? '2nd' : record.dose_number === 3 ? '3rd' : `${record.dose_number}th`;

        return {
          id: record.id,
          patientId,
          patientName,
          patientType: type,
          station,
          vaccineName,
          doseNumber: record.dose_number,
          doseText,
          scheduledDate: record.scheduled_vaccination,
          vaccinated_date: record.vaccinated_date,
          status: record.status,
          createdBy: record.staff_profiles?.full_name || 'System',
          notes: record.notes || ''
        };
      });
    } catch (error) {
      console.error('Error getting all vaccinations:', error);
      return [];
    }
  }

  /**
   * Get all vaccine types from inventory
   */
  async getAllVaccineTypes() {
    try {
      const { data, error } = await this.supabase
        .from('vaccine_inventory')
        .select('vaccine_name')
        .order('vaccine_name', { ascending: true });

      if (error) throw error;
      return data?.map(v => v.vaccine_name) || [];
    } catch (error) {
      console.error('Error getting vaccine types:', error);
      return [];
    }
  }
}

export default VaccinationService;
