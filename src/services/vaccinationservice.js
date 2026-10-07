import supabase from '../config/supabaseclient';
import AuthService from './authservice';
import { isNewbornVaccinationEligible } from '../utils/pregnancyUtils';

class VaccinationService {
  constructor() {
    this.authService = new AuthService();
    this.supabase = supabase;
  }

  async getCurrentUserId() {
    const user = await this.authService.getAuthUser();
    return user?.id || null;
  }

  async getCurrentUserStationId() {
    const userId = await this.getCurrentUserId();
    if (!userId) return null;

    const { data, error } = await this.supabase
      .from('staff_profiles')
      .select('station_ass')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;
    return data?.station_ass || null;
  }

  async getAssignedStaffForPatient(patientId) {
    const { data, error } = await this.supabase
      .from('prenatal_visits')
      .select('assigned_staff')
      .eq('patient_id', patientId)
      .not('assigned_staff', 'is', null)
      .order('visit_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data?.assigned_staff || null;
  }

  async getAssignedStaffForNewborn(newbornId) {
    const { data, error } = await this.supabase
      .from('newborns')
      .select('mother_id')
      .eq('id', newbornId)
      .maybeSingle();

    if (error) throw error;
    return data?.mother_id ? this.getAssignedStaffForPatient(data.mother_id) : null;
  }

  async getAssignedStationForPatient(patientId) {
    const { data, error } = await this.supabase
      .from('patient_basic_info')
      .select('station_ass')
      .eq('id', patientId)
      .maybeSingle();

    if (error) throw error;
    return data?.station_ass || null;
  }

  async getAssignedStationForNewborn(newbornId) {
    const { data, error } = await this.supabase
      .from('newborns')
      .select('mother_id')
      .eq('id', newbornId)
      .maybeSingle();

    if (error) throw error;
    return data?.mother_id ? this.getAssignedStationForPatient(data.mother_id) : null;
  }

  /**
   * Calculate a scheduled date from a birth date using calendar months and elapsed days.
   */
  computeScheduledDate = (birthDate, monthsOffset = 0, daysOffset = 0) => {
    const target = new Date(birthDate);
    const birthDay = target.getUTCDate();
    target.setUTCDate(1);
    target.setUTCMonth(target.getUTCMonth() + monthsOffset);
    const lastDayOfTargetMonth = new Date(Date.UTC(
      target.getUTCFullYear(),
      target.getUTCMonth() + 1,
      0
    )).getUTCDate();
    target.setUTCDate(Math.min(birthDay, lastDayOfTargetMonth) + daysOffset);
    return target;
  };

  /**
   * Resolve the best inventory batch for a vaccine/supplement.
   * Preference is exact name + brand, and the earliest expiration date wins.
   * When a station is provided, only stock that was distributed to that station is considered.
   */
  async resolveInventoryItem({ itemType, itemName, brand = null, stationId = null }) {
    const normalizedName = String(itemName || '').trim();
    if (!normalizedName) return null;

    const isVaccine = itemType === 'vaccine';
    const table = isVaccine ? 'vaccine_inventory' : 'supplement_inventory';
    const stationTable = isVaccine ? 'station_vaccine_inventory' : 'station_supplement_inventory';
    const idField = isVaccine ? 'vaccine_id' : 'supplement_inventory_id';
    const nameField = isVaccine ? 'vaccine_name' : 'supplement_name';
    const selectClause = isVaccine
      ? 'id, quantity, vaccine_name, brand, expiration_date'
      : 'id, quantity, supplement_name, brand, expiration_date';

    let stationRows = [];
    if (stationId) {
      const { data, error } = await this.supabase
        .from(stationTable)
        .select(`id, station_id, ${idField}, quantity`)
        .eq('station_id', stationId)
        .gt('quantity', 0);

      if (error) throw error;
      stationRows = data || [];
      if (stationRows.length === 0) return null;
    }

    const stationRowsByItem = new Map(stationRows.map(row => [row[idField], row]));
    const findEligible = async (exactName) => {
      let query = this.supabase
        .from(table)
        .select(selectClause)
        .order('expiration_date', { ascending: true, nullsFirst: false });

      if (stationId) {
        query = query.in('id', [...stationRowsByItem.keys()]);
      } else {
        query = query.gt('quantity', 0);
      }
      if (exactName) query = query.eq(nameField, exactName);
      if (brand) query = query.eq('brand', brand);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(item => ({
        ...item,
        station_inventory_id: stationRowsByItem.get(item.id)?.id || null,
        station_quantity: stationRowsByItem.get(item.id)?.quantity ?? null
      }));
    };

    const exactItems = await findEligible(normalizedName);
    if (exactItems.length > 0) return exactItems[0];
    if (brand) return null;

    const fallbackItems = await findEligible(null);
    const normalizedSearch = normalizedName.toLowerCase().replace(/[^a-z0-9]/g, '');
    return fallbackItems.find(item => {
      const candidateName = String(item[nameField] || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return candidateName.includes(normalizedSearch) || normalizedSearch.includes(candidateName);
    }) || null;
  }

  async decrementStationInventory({ itemType, inventoryItem, stationId }) {
    if (!stationId || !inventoryItem?.id) {
      throw new Error('Station inventory item is required');
    }

    const isVaccine = itemType === 'vaccine';
    const table = isVaccine ? 'station_vaccine_inventory' : 'station_supplement_inventory';
    const idField = isVaccine ? 'vaccine_id' : 'supplement_inventory_id';

    for (let attempt = 0; attempt < 3; attempt++) {
      const { data: stationItem, error: fetchError } = await this.supabase
        .from(table)
        .select('id, quantity')
        .eq('station_id', stationId)
        .eq(idField, inventoryItem.id)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!stationItem || Number(stationItem.quantity) <= 0) {
        throw new Error('No stock available at your assigned station');
      }

      const { data, error } = await this.supabase
        .from(table)
        .update({ quantity: Number(stationItem.quantity) - 1 })
        .eq('id', stationItem.id)
        .eq('quantity', stationItem.quantity)
        .gt('quantity', 0)
        .select('id')
        .maybeSingle();

      if (error) throw error;
      if (data) return true;
    }

    throw new Error('Station inventory changed while recording; please retry');
  }

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
      const { data: newborn, error: newbornError } = await this.supabase
        .from('newborns')
        .select('condition_at_birth')
        .eq('id', newbornId)
        .maybeSingle();

      if (newbornError) throw newbornError;
      if (!isNewbornVaccinationEligible(newborn)) {
        return { success: true, count: 0, skipped: true };
      }

      const vaccineSchedule = [
        // 6 weeks
        { weeks: 6, vaccines: [
            'Pentavalent Vaccine (DPT-Hep B-Hib)',
            'Oral Polio Vaccine (OPV)',
            'Pneumococcal Conjugate Vaccine (PCV)'
          ], doses: [1, 1, 1] },

        // 10 weeks
        { weeks: 10, vaccines: [
            'Pentavalent Vaccine (DPT-Hep B-Hib)',
            'Oral Polio Vaccine (OPV)',
            'Pneumococcal Conjugate Vaccine (PCV)'
          ], doses: [2, 2, 2] },

        // 14 weeks
        { weeks: 14, vaccines: [
            'Pentavalent Vaccine (DPT-Hep B-Hib)',
            'Oral Polio Vaccine (OPV)',
            'Inactivated Polio Vaccine (IPV)',
            'Pneumococcal Conjugate Vaccine (PCV)'
          ], doses: [3, 3, 1, 3] },

        // 6 months
        { months: 6, vaccines: ['Vitamin A'], doses: [1] },

        // 9 months
        { months: 9, vaccines: [
            'Inactivated Polio Vaccine (IPV)',
            'Measles, Mumps, Rubella Vaccine (MMR)'
          ], doses: [2, 1] },

        // 12 months (1 year)
        { months: 12, vaccines: [
            'Measles, Mumps, Rubella Vaccine (MMR)'
          ], doses: [2] }
      ];

      const birthDateObj = new Date(birthDate);
      if (Number.isNaN(birthDateObj.getTime())) {
        throw new Error('Invalid baby birth date provided for newborn vaccination schedule');
      }

      const assignedStaff = await this.getAssignedStaffForNewborn(newbornId);
      const assignedStation = await this.getAssignedStationForNewborn(newbornId);
      const inserts = [];
      const updates = [];
      const { data: existingRecords, error: existingError } = await this.supabase
        .from('vaccinations')
        .select('id, status, vaccinated_date, scheduled_vaccination, notes')
        .eq('newborn_id', newbornId);

      if (existingError) throw existingError;

      const existingByNotes = new Map();
      for (const record of existingRecords || []) {
        const previous = existingByNotes.get(record.notes);
        const isCompleted = record.status?.toLowerCase() === 'completed' || record.vaccinated_date;
        const previousIsCompleted = previous?.status?.toLowerCase() === 'completed' || previous?.vaccinated_date;
        if (!previous || (isCompleted && !previousIsCompleted)) {
          existingByNotes.set(record.notes, record);
        }
      }

      for (const schedule of vaccineSchedule) {
        const scheduledDate = this.computeScheduledDate(
          birthDateObj,
          schedule.months || 0,
          (schedule.weeks || 0) * 7
        );
        const dateStr = scheduledDate.toISOString().split('T')[0];

        for (let i = 0; i < schedule.vaccines.length; i++) {
          const vaccine = schedule.vaccines[i];
          const dose = schedule.doses[i];
          const doseOrdinal = dose === 1 ? '1st' : dose === 2 ? '2nd' : dose === 3 ? '3rd' : `${dose}th`;
          const notes = `${doseOrdinal} dose of ${vaccine}`;
          const existingRecord = existingByNotes.get(notes);

          if (existingRecord) {
            if (
              existingRecord.status?.toLowerCase() === 'pending' &&
              !existingRecord.vaccinated_date &&
              existingRecord.scheduled_vaccination !== dateStr
            ) {
              updates.push({ id: existingRecord.id, scheduled_vaccination: dateStr });
            }
            continue;
          }

          // Vitamin A is managed through supplement inventory, not vaccine inventory.
          const vaccineId = vaccine === 'Vitamin A' ? null : await this.getVaccineInventoryId(vaccine);

          inserts.push({
            newborn_id: newbornId,
            vaccine_inventory_id: vaccineId,
            dose_number: dose,
            scheduled_vaccination: dateStr,
            vaccinated_date: null,
            status: 'Pending',
            created_by: createdBy,
            assigned_staff: assignedStaff,
            station_ass: assignedStation,
            notes
          });
        }
      }

      for (const update of updates) {
        const { id, ...values } = update;
        const { error } = await this.supabase
          .from('vaccinations')
          .update(values)
          .eq('id', id);
        if (error) throw error;
      }

      if (inserts.length > 0) {
        const { error } = await this.supabase
          .from('vaccinations')
          .insert(inserts);

        if (error) throw error;
      }
      console.log(`✅ Scheduled ${inserts.length} new doses and updated ${updates.length} pending doses for newborn ${newbornId}`);
      return { success: true, count: inserts.length, updated: updates.length };
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
      if (patientType !== 'Newborn') {
        throw new Error('Vaccination records can only be recorded for newborns.');
      }

      const currentUser = await this.getCurrentUserId();
      if (!currentUser) throw new Error('No logged-in user');
      const { data: userProfile, error: profileError } = await this.supabase
        .from('staff_profiles')
        .select('station_ass')
        .eq('id', currentUser)
        .maybeSingle();
      if (profileError) throw profileError;
      const performingStationId = userProfile?.station_ass;
      if (!performingStationId) throw new Error('Your account must have an assigned service station.');

      const { vaccineId, vaccineName, doseNumber, date, staff, notes, remarks } = vaccineData;

      const vaccInv = await this.resolveInventoryItem({
        itemType: 'vaccine',
        itemName: vaccineName,
        stationId: performingStationId
      });
      if (!vaccInv) throw new Error('Vaccine not found in your station inventory or out of stock');
      const assignedStaff = await this.getAssignedStaffForNewborn(patientId);

      if (vaccineId) {
        // Update existing scheduled vaccine record
        const { error: updateError } = await this.supabase
          .from('vaccinations')
          .update({
            vaccine_inventory_id: vaccInv.id,
            vaccinated_date: date,
            status: 'Completed',
            station_ass: performingStationId,
            created_by: currentUser,
            vaccinated_by: currentUser,
            assigned_staff: assignedStaff,
            notes: notes || null,
            remarks: remarks || null
          })
          .eq('id', vaccineId);

        if (updateError) throw updateError;
      } else {
        // Create new vaccination record (for manual entries not in schedule)
        const payload = {
          newborn_id: patientId,
          vaccine_inventory_id: vaccInv.id,
          dose_number: doseNumber,
          vaccinated_date: date,
          scheduled_vaccination: date,
          status: 'Completed',
          station_ass: performingStationId,
          created_by: currentUser,
          vaccinated_by: currentUser,
          assigned_staff: assignedStaff,
          notes: notes || null,
          remarks: remarks || null
        };

        const { error: insertError } = await this.supabase
          .from('vaccinations')
          .insert([payload]);

        if (insertError) throw insertError;
      }

      await this.decrementStationInventory({
        itemType: 'vaccine',
        inventoryItem: vaccInv,
        stationId: performingStationId
      });

      return { success: true };
    } catch (error) {
      console.error('Error recording vaccine:', error);
      throw error;
    }
  }

  /**
   * Get all pending (unrecorded) vaccines for a patient
   */
  async getPendingVaccinesForPatient(patientId) {
    try {
      const { data: vaccRecords, error } = await this.supabase
        .from('vaccinations')
        .select('id, vaccine_inventory_id, dose_number, scheduled_vaccination, status, notes')
        .eq('newborn_id', patientId)
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
  async getScheduledVaccinesByDate(patientId) {
    try {
      const { data: vaccRecords, error } = await this.supabase
        .from('vaccinations')
        .select('id, dose_number, scheduled_vaccination, status, vaccine_inventory_id, notes')
        .eq('newborn_id', patientId)
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
          newborns!vaccinations_newborn_id_fkey (
            id, 
            baby_name, 
            mother_id, 
            patient_basic_info!mother_id (first_name, last_name, station_ass, stations:station_ass (station_name), province)
          )
        `)
        .not('newborn_id', 'is', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (vaccRecords || []).map(record => {
        const newbornRecord = Array.isArray(record.newborns) ? record.newborns[0] : record.newborns;
        const mother = Array.isArray(newbornRecord?.patient_basic_info) ? newbornRecord.patient_basic_info[0] : newbornRecord?.patient_basic_info;
        const patientName = newbornRecord?.baby_name || 'Unknown Newborn';
        const station = `${mother?.stations?.station_name || 'N/A'}, ${mother?.province || 'N/A'}`;

        let vaccineName = record.vaccine_inventory?.vaccine_name || 'Unrecorded';
        let doseText = record.dose_number === 1 ? '1st' : record.dose_number === 2 ? '2nd' : record.dose_number === 3 ? '3rd' : `${record.dose_number}th`;

        return {
          id: record.id,
          patientId: record.newborn_id,
          patientName,
          patientType: 'Newborn',
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
