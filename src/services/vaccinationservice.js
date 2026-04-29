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
   * Get vaccine_inventory_id by vaccine name (with fuzzy matching)
   */
  async getVaccineInventoryId(vaccineName) {
    try {
      // Try exact match first
      const { data: exactMatch } = await this.supabase
        .from('vaccine_inventory')
        .select('id')
        .eq('vaccine_name', vaccineName)
        .gt('quantity', 0)
        .order('expiration_date', { ascending: true, nullsFirst: false })
        .limit(1)
        .maybeSingle();

      if (exactMatch) return exactMatch.id;

      // Try fuzzy match - check if inventory name contains the search term or vice versa
      const { data: fuzzyMatches } = await this.supabase
        .from('vaccine_inventory')
        .select('id, vaccine_name')
        .gt('quantity', 0)
        .order('expiration_date', { ascending: true, nullsFirst: false });

      if (fuzzyMatches) {
        // Normalize names for comparison
        const normalizedSearch = vaccineName.toLowerCase().replace(/[^a-z0-9]/g, '');
        
        for (const item of fuzzyMatches) {
          const normalizedItem = item.vaccine_name.toLowerCase().replace(/[^a-z0-9]/g, '');
          
          // Check if one contains the other
          if (normalizedSearch.includes(normalizedItem) || normalizedItem.includes(normalizedSearch)) {
            return item.id;
          }
        }
      }

      return null;
    } catch (error) {
      console.error('Error getting vaccine inventory ID:', error);
      return null;
    }
  }

  /**
   * Automatically schedule vaccinations for newborn based on birth date
   * Creates records with vaccine_inventory_id, date, expiration_date, next_due, and status
   * If baby was born recently and hasn't got vaccines, start from now instead of birth date
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
      const today = new Date();
      
      // Check if baby was born recently (within 3 months) and hasn't got vaccines yet
      const daysSinceBirth = Math.floor((today - birthDateObj) / (1000 * 60 * 60 * 24));
      const useTodayAsBase = daysSinceBirth > 0 && daysSinceBirth < 90;
      const baseDate = useTodayAsBase ? today : birthDateObj;
      
      const inserts = [];

      for (const schedule of vaccineSchedule) {
        const scheduledDate = this.computeScheduledDate(baseDate, schedule.months);
        const dateStr = scheduledDate.toISOString().split('T')[0];

        for (let i = 0; i < schedule.vaccines.length; i++) {
          const vaccine = schedule.vaccines[i];
          const dose = schedule.doses[i];
          const doseOrdinal = dose === 1 ? '1st' : dose === 2 ? '2nd' : dose === 3 ? '3rd' : `${dose}th`;

          // Get vaccine inventory ID using helper method with fuzzy matching
          const vaccineId = await this.getVaccineInventoryId(vaccine);

          // Calculate next due date (next vaccine in schedule)
          let nextDue = null;
          const nextScheduleIndex = vaccineSchedule.findIndex(s => s.months > schedule.months);
          if (nextScheduleIndex !== -1) {
            const nextSchedule = vaccineSchedule[nextScheduleIndex];
            const nextDate = this.computeScheduledDate(baseDate, nextSchedule.months);
            nextDue = nextDate.toISOString().split('T')[0];
          }

          inserts.push({
            newborn_id: newbornId,
            vaccine_inventory_id: vaccineId,
            dose_number: dose,
            scheduled_vaccination: dateStr,
            vaccinated_date: null,
            status: 'Pending',
            created_by: createdBy,
            notes: `${doseOrdinal} dose of ${vaccine}`
          });
        }
      }

      const { error } = await this.supabase
        .from('vaccinations')
        .insert(inserts);

      if (error) throw error;
      console.log(`✅ Scheduled ${inserts.length} vaccines for newborn ${newbornId} (base date: ${useTodayAsBase ? 'today' : 'birth date'})`);
      return { success: true, count: inserts.length };
    } catch (error) {
      console.error('Error scheduling newborn vaccinations:', error);
      throw error;
    }
  }

  /**
   * Record a vaccine dose - fills in vaccine_inventory_id and marks as Completed
   * Also decrements the vaccine inventory quantity (using nearest expiration date)
   * Triggers automatic maternal vaccination scheduling if first Td vaccine
   */
  async recordVaccine(patientId, patientType, vaccineData) {
    try {
      const currentUser = await this.getCurrentUserId();
      if (!currentUser) throw new Error('No logged-in user');

      const { vaccineId, vaccineName, doseNumber, date, staff, notes, lmpDate } = vaccineData;

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

      // Trigger automatic maternal vaccination scheduling if this is first Td vaccine for a mother
      if (patientType === 'Mother' && (vaccineName.includes('Td') || vaccineName.includes('Tetanus'))) {
        // Check if this is the first Td vaccine (dose 1)
        const { data: existingTdVaccines } = await this.supabase
          .from('vaccinations')
          .select('id, dose_number')
          .eq('patient_id', patientId)
          .ilike('notes', '%Td%')
          .eq('status', 'Completed');
        
        const isFirstTd = !existingTdVaccines || existingTdVaccines.length === 0;
        
        if (isFirstTd) {
          console.log(`🔄 First Td vaccine recorded for mother ${patientId}, scheduling remaining doses...`);
          await this.scheduleMaternalVaccinations(patientId, date, vaccineName, currentUser, lmpDate);
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

  /**
   * Automatically schedule maternal vaccinations based on Philippines DOH schedule
   * When first vaccine is given, schedule remaining doses
   */
  async scheduleMaternalVaccinations(patientId, firstVaccineDate, firstVaccineName, createdBy, lmpDate = null) {
    try {
      const schedule = [];
      const baseDate = new Date(firstVaccineDate);
      
      // Tetanus-Diphtheria (Td) Schedule
      if (firstVaccineName.includes('Td') || firstVaccineName.includes('Tetanus')) {
        const tdVaccineId = await this.getVaccineInventoryId('Tetanus Diphtheria (TD)');
        
        // Td2: 4 weeks after Td1
        const td2Date = new Date(baseDate);
        td2Date.setDate(td2Date.getDate() + 28);
        const td2DateStr = td2Date.toISOString().split('T')[0];
        schedule.push({
          patient_id: patientId,
          vaccine_inventory_id: tdVaccineId,
          dose_number: 2,
          scheduled_vaccination: td2DateStr,
          status: 'Pending',
          vaccinated_date: null,
          created_by: createdBy,
          notes: '2nd dose of Tetanus-Diphtheria (Td2) - 4 weeks after Td1'
        });

        // Td3: 6 months after Td2
        const td3Date = new Date(td2Date);
        td3Date.setMonth(td3Date.getMonth() + 6);
        const td3DateStr = td3Date.toISOString().split('T')[0];
        schedule.push({
          patient_id: patientId,
          vaccine_inventory_id: tdVaccineId,
          dose_number: 3,
          scheduled_vaccination: td3DateStr,
          status: 'Pending',
          vaccinated_date: null,
          created_by: createdBy,
          notes: '3rd dose of Tetanus-Diphtheria (Td3) - 6 months after Td2'
        });

        // Td4: 1 year after Td3
        const td4Date = new Date(td3Date);
        td4Date.setFullYear(td4Date.getFullYear() + 1);
        const td4DateStr = td4Date.toISOString().split('T')[0];
        schedule.push({
          patient_id: patientId,
          vaccine_inventory_id: tdVaccineId,
          dose_number: 4,
          scheduled_vaccination: td4DateStr,
          status: 'Pending',
          vaccinated_date: null,
          created_by: createdBy,
          notes: '4th dose of Tetanus-Diphtheria (Td4) - 1 year after Td3'
        });

        // Td5: 1 year after Td4
        const td5Date = new Date(td4Date);
        td5Date.setFullYear(td5Date.getFullYear() + 1);
        const td5DateStr = td5Date.toISOString().split('T')[0];
        schedule.push({
          patient_id: patientId,
          vaccine_inventory_id: tdVaccineId,
          dose_number: 5,
          scheduled_vaccination: td5DateStr,
          status: 'Pending',
          vaccinated_date: null,
          created_by: createdBy,
          notes: '5th dose of Tetanus-Diphtheria (Td5) - 1 year after Td4'
        });
      }

      // Influenza (Flu) - schedule if not already given and patient is pregnant
      if (lmpDate) {
        const lmp = new Date(lmpDate);
        const edd = new Date(lmp);
        edd.setDate(edd.getDate() + 280);
        
        // Check if flu vaccine was already given (check for existing flu vaccination)
        const { data: existingFlu } = await this.supabase
          .from('vaccinations')
          .select('id')
          .eq('patient_id', patientId)
          .ilike('notes', '%Flu%')
          .eq('status', 'Completed')
          .single();
        
        if (!existingFlu) {
          const fluVaccineId = await this.getVaccineInventoryId('Influenza Vaccine');
          
          // Schedule flu for any trimester (use current date or next available)
          const fluDate = new Date(baseDate);
          fluDate.setDate(fluDate.getDate() + 7); // Schedule 1 week after first vaccine
          const fluDateStr = fluDate.toISOString().split('T')[0];
          
          // Make sure it's within pregnancy window
          if (fluDate <= edd) {
            schedule.push({
              patient_id: patientId,
              vaccine_inventory_id: fluVaccineId,
              dose_number: 1,
              scheduled_vaccination: fluDateStr,
              status: 'Pending',
              vaccinated_date: null,
              created_by: createdBy,
              notes: '1st dose of Influenza (Flu) Vaccine - Once per pregnancy'
            });
          }
        }
      }

      if (schedule.length > 0) {
        const { error } = await this.supabase
          .from('vaccinations')
          .insert(schedule);
        
        if (error) throw error;
        console.log(`✅ Scheduled ${schedule.length} maternal vaccines for patient ${patientId}`);
        return { success: true, count: schedule.length };
      }

      return { success: true, count: 0 };
    } catch (error) {
      console.error('Error scheduling maternal vaccinations:', error);
      throw error;
    }
  }

  /**
   * Schedule postpartum vaccinations for mother after delivery
   * MMR (if not immune) only
   * If birth was recent (within 90 days) and vaccinations not given, start from today
   */
  async schedulePostpartumMaternalVaccinations(patientId, deliveryDate, createdBy) {
    try {
      const schedule = [];
      const today = new Date();
      const deliveryDateObj = new Date(deliveryDate);
      const daysSinceDelivery = Math.floor((today - deliveryDateObj) / (1000 * 60 * 60 * 24));
      
      // If birth was recent (within 90 days), start from today instead of delivery date
      const baseDate = daysSinceDelivery <= 90 ? today : deliveryDateObj;
      
      // Get vaccine inventory IDs
      const mmrVaccineId = await this.getVaccineInventoryId('MMR (Measles, Mumps, Rubella) Vaccine');
      
      // MMR - After delivery (if not immune)
      const mmrDate = new Date(baseDate);
      mmrDate.setDate(mmrDate.getDate() + 1); // Day after delivery (or today + 1 if recent)
      const mmrDateStr = mmrDate.toISOString().split('T')[0];
      schedule.push({
        patient_id: patientId,
        vaccine_inventory_id: mmrVaccineId,
        dose_number: 1,
        scheduled_vaccination: mmrDateStr,
        status: 'Pending',
        vaccinated_date: null,
        created_by: createdBy,
        notes: '1st dose of MMR (Measles, Mumps, Rubella) - After delivery if not immune'
      });

      const { error } = await this.supabase
        .from('vaccinations')
        .insert(schedule);
      
      if (error) throw error;
      console.log(`✅ Scheduled ${schedule.length} postpartum maternal vaccines for patient ${patientId}`);
      return { success: true, count: schedule.length };
    } catch (error) {
      console.error('Error scheduling postpartum maternal vaccinations:', error);
      throw error;
    }
  }
}

export default VaccinationService;
