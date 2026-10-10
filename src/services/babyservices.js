import supabase from '../config/supabaseclient';
import PatientService from './patientservice';
import { buildPregnancyHistory, getLatestPregnancyRecord, getPregnancyForDelivery } from '../utils/pregnancyUtils';

class BabyService {
  constructor() {
    this.patientService = new PatientService();
  }

  async searchPregnantMothers(query) {
    try {
      const term = (query || '').trim();
      if (!term || term.length < 2) return [];

      const safeTerm = term.replace(/%/g, '\\%');
      const patientSelect = `
          id,
          first_name,
          last_name,
          station_ass,
          stations:station_ass (station_name),
          province
        `;
      const [firstNameResult, lastNameResult, stationResult] = await Promise.all([
        supabase.from('patient_basic_info').select(patientSelect).ilike('first_name', `%${safeTerm}%`).order('created_at', { ascending: false }).limit(10),
        supabase.from('patient_basic_info').select(patientSelect).ilike('last_name', `%${safeTerm}%`).order('created_at', { ascending: false }).limit(10),
        supabase.from('patient_basic_info').select(patientSelect).ilike('stations.station_name', `%${safeTerm}%`).order('created_at', { ascending: false }).limit(10)
      ]);

      const queryError = firstNameResult.error || lastNameResult.error || stationResult.error;
      if (queryError) throw queryError;

      const patients = [...(firstNameResult.data || []), ...(lastNameResult.data || []), ...(stationResult.data || [])]
        .filter((patient, index, rows) => rows.findIndex(row => row.id === patient.id) === index);

      if (patients.length === 0) return [];

      const patientIds = patients.map(patient => patient.id);
      const { data: pregnancyRows, error: pregnancyError } = await supabase
        .from('pregnancy_info')
        .select('id, patient_id, pregn_postp, edd, pregnancy_type, lmd, gravida, para, created_at')
        .in('patient_id', patientIds)
        .order('created_at', { ascending: false });
      if (pregnancyError) throw pregnancyError;

      const latestPregnancyByPatient = new Map();
      for (const pregnancy of pregnancyRows || []) {
        if (!latestPregnancyByPatient.has(pregnancy.patient_id)) {
          latestPregnancyByPatient.set(pregnancy.patient_id, pregnancy);
        }
      }

      const missingStationIds = [...new Set(
        patients
          .filter(patient => {
            const joinedStations = Array.isArray(patient.stations) ? patient.stations : [patient.stations];
            return !joinedStations.some(station => station?.station_name) && patient.station_ass;
          })
          .map(patient => patient.station_ass)
      )];
      let stationNamesById = new Map();
      if (missingStationIds.length > 0) {
        const { data: stationRows, error: stationError } = await supabase
          .from('stations')
          .select('id, station_name')
          .in('id', missingStationIds);
        if (stationError) throw stationError;
        stationNamesById = new Map((stationRows || []).map(station => [station.id, station.station_name]));
      }

      return patients.map(patient => {
        const preg = latestPregnancyByPatient.get(patient.id);
        const joinedStations = Array.isArray(patient.stations) ? patient.stations : [patient.stations];
        const stationName = joinedStations.find(station => station?.station_name)?.station_name
          || stationNamesById.get(patient.station_ass)
          || 'No Station';
        // Calculate gestational age from LMP
        let gestationalAge = '';
        if (preg?.lmd) {
          const lmpDate = new Date(preg.lmd);
          const today = new Date();
          const diffTime = today - lmpDate;
          const diffWeeks = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));
          const days = Math.floor((diffTime % (1000 * 60 * 60 * 24 * 7)) / (1000 * 60 * 60 * 24));
          if (diffWeeks >= 0) {
            gestationalAge = `${diffWeeks}${days > 3 ? '+' : ''} weeks`;
          }
        }

        return {
          id: patient.id,
          name: `${patient.first_name || ''} ${patient.last_name || ''}`.trim(),
          stationId: patient.station_ass || null,
          station: `${stationName}, ${patient.province || 'N/A'}`,
          riskLevel: 'Normal', // Default risk level since calculated_risk field doesn't exist
          isPregnant: preg?.pregn_postp?.toLowerCase() === 'pregnant',
          pregnancyType: preg?.pregnancy_type || 'Singleton',
          lmp: preg?.lmd || null,
          gestationalAge: gestationalAge,
          gravida: preg?.gravida || 1,
          para: preg?.para || 0
        };
      }).filter(patient => patient.isPregnant).slice(0, 10);
    } catch (error) {
      console.error('Error in searchPregnantMothers:', error);
      return [];
    }
  }

  async searchNewborns(query) {
    const term = (query || '').trim();
    if (!term || term.length < 2) return [];

    const safeTerm = term.trim().replace(/%/g, '\\%');

    // Search by baby_name first
    const { data: newbornsByName, error: nameError } = await supabase
      .from('newborns')
      .select(`
        id,
        baby_name,
        mother_id,
        deliveries!inner (delivery_date),
        patient_basic_info!mother_id (
          first_name,
          last_name,
          station_ass,
            stations:station_ass (station_name),
          province
        )
      `)
      .ilike('baby_name', `%${safeTerm}%`)
      .order('created_at', { ascending: false })
      .limit(10);

    if (nameError) throw nameError;

    // Search by mother's name (need to get patient IDs first)
    const { data: patients, error: patientError } = await supabase
      .from('patient_basic_info')
      .select('id')
      .or(`first_name.ilike.%${safeTerm}%,last_name.ilike.%${safeTerm}%`)
      .limit(10);

    if (patientError) throw patientError;

    const motherIds = patients ? patients.map(p => p.id) : [];
    let newbornsByMother = [];

    if (motherIds.length > 0) {
      const { data: newbornsByMotherData, error: motherError } = await supabase
        .from('newborns')
        .select(`
          id,
          baby_name,
          mother_id,
          deliveries!inner (delivery_date),
          patient_basic_info!mother_id (
            first_name,
            last_name,
            station_ass,
              stations:station_ass (station_name),
            province
          )
        `)
        .in('mother_id', motherIds)
        .order('created_at', { ascending: false })
        .limit(10);

      if (motherError) throw motherError;
      newbornsByMother = newbornsByMotherData || [];
    }

    // Combine and deduplicate results
    const allNewborns = [...(newbornsByName || []), ...newbornsByMother];
    const uniqueNewborns = [];
    const seenIds = new Set();

    for (const newborn of allNewborns) {
      if (!seenIds.has(newborn.id)) {
        seenIds.add(newborn.id);
        uniqueNewborns.push(newborn);
      }
    }

    return uniqueNewborns.map(newborn => {
      const mother = newborn.patient_basic_info;
      return {
        id: newborn.id,
        name: newborn.baby_name || `Newborn of ${mother.first_name} ${mother.last_name}`,
        station: `${mother.stations?.station_name || 'No Station'}, ${mother.province || 'N/A'}`,
        motherName: `${mother.first_name || ''} ${mother.last_name || ''}`.trim(),
        birthDate: newborn.deliveries.delivery_date,
        motherId: newborn.mother_id
      };
    });
  }

  calculateWeeksAtDate(lmp, targetDate) {
    if (!lmp || !targetDate) return 0;

    const lmpDate = new Date(lmp);
    const target = new Date(targetDate);
    if (Number.isNaN(lmpDate.getTime()) || Number.isNaN(target.getTime())) return 0;

    return Math.max(0, Math.floor((target - lmpDate) / (1000 * 60 * 60 * 24 * 7)));
  }

  async getAllDeliveries() {
    try {
      const { role, stationId } = await this.patientService.getCurrentUserAccess();
      const { data, error } = await supabase
        .from('deliveries')
        .select(`
          id,
          pregnancy_id,
          station_ass,
          attending_staff,
          delivery_date,
          delivery_time,
          delivery_type,
          delivery_mode,
          gestational_age,
          risk_level,
          complications,
          notes,
          created_at,
          stations:station_ass (station_name),
          patient_basic_info!deliveries_mother_id_fkey (
            id,
            first_name,
            last_name,
            station_ass,
            stations:station_ass (station_name)
          ),
          newborns (
            id,
            gender,
            birth_weight,
            birth_length,
            head_circumference,
            apgar_1min,
            apgar_5min,
            condition_at_birth,
            risk_level
          ),
          staff_profiles!deliveries_attending_staff_fkey (
            id, full_name, station_ass,
            stations:station_ass (station_name)
          )
        `)
        .order('delivery_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      const { data: miscarriageRows, error: miscarriageError } = await supabase
        .from('pregnancy_info')
        .select(`
          id,
          patient_id,
          lmd,
          edd,
          miscarriage_info,
          created_at,
          patient_basic_info!pregnancy_info_patient_id_fkey (
            id,
            first_name,
            last_name,
            station_ass,
            stations:station_ass (station_name)
          )
        `)
        .not('miscarriage_info', 'is', null)
        .order('created_at', { ascending: false });

      if (miscarriageError) throw miscarriageError;

      const filtered = (data || []).filter(d => {
        if (role === 'admin') return true;
        if (['cho personnel', 'staff'].includes(role)) {
          return d.station_ass && stationId && d.station_ass === stationId;
        }
        return false;
      });

      const filteredMiscarriages = (miscarriageRows || []).filter(row => {
        if (role === 'admin') return true;
        if (['cho personnel', 'staff'].includes(role)) {
          return row.patient_basic_info?.station_ass === stationId;
        }
        return false;
      });

      const deliveryIds = filtered.map(delivery => delivery.id);
      const { data: postpartumVisits, error: postpartumVisitsError } = deliveryIds.length
        ? await supabase
          .from('postpartum_visits')
          .select('id, delivery_id, patient_id, visit_number, visit_type, scheduled_date, scheduled_at, status, attended_date, assigned_staff, assigned_station, station_ass, personnel_present, performed_by, assessment, notes')
          .in('delivery_id', deliveryIds)
          .order('scheduled_at', { ascending: true })
        : { data: [], error: null };
      if (postpartumVisitsError) throw postpartumVisitsError;

      const motherIds = [...new Set(filtered.map(delivery => delivery.patient_basic_info?.id).filter(Boolean))];
      const [{ data: mothers }, { data: pregnancies }, { data: visits }] = await Promise.all([
        supabase.from('patient_basic_info').select('id, date_of_birth').in('id', motherIds),
        supabase.from('pregnancy_info').select('id, patient_id, pregnancy_type, gravida, place_of_delivery, created_at').in('patient_id', motherIds).order('created_at', { ascending: false }),
        supabase.from('prenatal_visits').select('patient_id, visit_date, status, risk_factors, bp_systolic, bp_diastolic, temp_c, pulse_bpm, resp_rate_cpm, fhr_bpm').in('patient_id', motherIds).eq('status', 'Attended').order('visit_date', { ascending: false })
      ]);
      const motherMap = new Map((mothers || []).map(mother => [mother.id, mother]));
      
      const pregnancyMap = new Map((pregnancies || []).map(p => [p.id, p]));
      
      const visitsByMother = new Map();
      (visits || []).forEach(v => {
        if (!visitsByMother.has(v.patient_id)) {
          visitsByMother.set(v.patient_id, []);
        }
        visitsByMother.get(v.patient_id).push(v);
      });

      const postpartumVisitsByDelivery = new Map();
      (postpartumVisits || []).forEach(visit => {
        const schedule = postpartumVisitsByDelivery.get(visit.delivery_id) || [];
        schedule.push(visit);
        postpartumVisitsByDelivery.set(visit.delivery_id, schedule);
      });

      const deliveryRecords = filtered.map(d => {
        const newborn = Array.isArray(d.newborns) ? d.newborns[0] : d.newborns;
        const staff = Array.isArray(d.staff_profiles) ? d.staff_profiles[0] : d.staff_profiles;
        const motherId = d.patient_basic_info?.id || '';
        
        const matchedPregnancy = d.pregnancy_id ? pregnancyMap.get(d.pregnancy_id) : (pregnancies || []).find(p => p.patient_id === motherId);
        
        const motherVisits = visitsByMother.get(motherId) || [];
        const deliveryDateObj = d.delivery_date ? new Date(d.delivery_date) : new Date();
        const matchedVisit = motherVisits.find(v => new Date(v.visit_date) <= deliveryDateObj) || motherVisits[0] || null;

        const riskAssessment = this.patientService.getPregnancyRisk(
          motherMap.get(motherId),
          matchedPregnancy || {},
          matchedVisit
        );
        const scheduledVisits = postpartumVisitsByDelivery.get(d.id) || [];
        return {
          id: d.id,
          pregnancyId: d.pregnancy_id || null,
          attendingStaffId: d.attending_staff || null,
          patientId: motherId,
          patientName: `${d.patient_basic_info?.first_name || ''} ${d.patient_basic_info?.last_name || ''}`.trim(),
          stationId: d.station_ass || null,
          station: d.stations?.station_name || 'Unassigned',
          deliveryDate: d.delivery_date,
          deliveryTime: d.delivery_time,
          deliveryType: d.delivery_type,
          deliveryMode: d.delivery_mode || 'N/A',
          gestationalAge: d.gestational_age || 'N/A',
          riskLevel: riskAssessment.riskLevel,
          complications: Array.isArray(d.complications) && d.complications.length ? d.complications.join(', ') : 'None',
          babyName: newborn?.baby_name || null,
          babyOutcome: newborn?.condition_at_birth || 'Healthy',
          babyGender: newborn?.gender || 'N/A',
          birthWeight: newborn?.birth_weight || null,
          birthLength: newborn?.birth_length || null,
          headCircumference: newborn?.head_circumference || null,
          apgar1: newborn?.apgar_1min || null,
          apgar5: newborn?.apgar_5min || null,
          staff: staff?.full_name || (d.attending_staff ? d.attending_staff : 'Unassigned'),
          staffStation: staff?.stations?.station_name || null,
          facility: matchedPregnancy?.place_of_delivery || 'N/A',
          postpartumVisits: scheduledVisits,
          notes: d.notes || '',
          pregnancyOutcome: (d.delivery_type === 'N/A - Not Applicable' && newborn?.condition_at_birth === 'N/A - No Baby')
            ? 'Miscarriage'
            : newborn?.condition_at_birth === 'Stillbirth' ? 'Stillbirth' : 'Live Birth'
        };
      });

      const miscarriageRecords = filteredMiscarriages.map(row => {
        const mother = row.patient_basic_info;
        const info = row.miscarriage_info || {};
        return {
          id: `miscarriage-${row.id}`,
          pregnancyId: row.id,
          patientId: mother?.id || row.patient_id,
          patientName: `${mother?.first_name || ''} ${mother?.last_name || ''}`.trim(),
          station: mother?.stations?.station_name || 'Unassigned',
          deliveryDate: info.date || row.created_at?.split('T')[0] || null,
          deliveryTime: null,
          deliveryType: 'N/A - Not Applicable',
          deliveryMode: 'N/A',
          gestationalAge: row.lmd ? `${this.calculateWeeksAtDate(row.lmd, info.date || row.created_at)} weeks` : 'N/A',
          riskLevel: 'Normal',
          complications: 'None',
          babyName: null,
          babyOutcome: 'N/A - No Baby',
          babyGender: 'N/A',
          birthWeight: null,
          birthLength: null,
          headCircumference: null,
          apgar1: null,
          apgar5: null,
          staff: 'Unassigned',
          facility: null,
          postpartumVisits: [],
          notes: info.notes || '',
          miscarriageInfo: info,
          pregnancyOutcome: 'Miscarriage'
        };
      });

      return [...deliveryRecords, ...miscarriageRecords].sort((a, b) => new Date(b.deliveryDate || 0) - new Date(a.deliveryDate || 0));
    } catch (error) {
      console.error('Error in getAllDeliveries:', error);
      return [];
    }
  }

  async recordDelivery(deliveryData, newbornData, deliveryId = null) {
    const createdBy = await this.patientService.getCurrentUserId();
    if (!createdBy) throw new Error('No logged-in user');
    const { data: attendingProfile, error: attendingProfileError } = await supabase
      .from('staff_profiles')
      .select('station_ass')
      .eq('id', createdBy)
      .maybeSingle();
    if (attendingProfileError) throw attendingProfileError;

    const deliveryStationId = deliveryId
      ? deliveryData.station_ass
      : attendingProfile?.station_ass;
    if (!deliveryStationId) throw new Error('The attending staff member must have an assigned station to record a delivery.');

    if (deliveryData.outcome === 'Miscarriage') {
      const { data: pregnancyRows, error: pregnancyError } = await supabase
        .from('pregnancy_info')
        .select('*')
        .eq('patient_id', deliveryData.mother_id)
        .order('created_at', { ascending: false });

      if (pregnancyError) throw pregnancyError;
      const currentPregnancy = getLatestPregnancyRecord(pregnancyRows || []);
      if (String(currentPregnancy?.pregn_postp || '').toLowerCase() !== 'pregnant') {
        throw new Error('The latest pregnancy record is not currently pregnant.');
      }

      const miscarriageInfo = {
        outcome: 'Miscarriage',
        date: deliveryData.miscarriage_info?.date || deliveryData.delivery_date,
        symptoms: Array.isArray(deliveryData.miscarriage_info?.symptoms)
          ? deliveryData.miscarriage_info.symptoms
          : [],
        bleeding: deliveryData.miscarriage_info?.bleeding || '',
        pain: deliveryData.miscarriage_info?.pain || '',
        suspected_cause: deliveryData.miscarriage_info?.suspected_cause || '',
        pregnancy_tissue_passed: deliveryData.miscarriage_info?.pregnancy_tissue_passed || '',
        vital_signs: {
          blood_pressure: deliveryData.miscarriage_info?.vital_signs?.blood_pressure || '',
          pulse: deliveryData.miscarriage_info?.vital_signs?.pulse || '',
          temperature: deliveryData.miscarriage_info?.vital_signs?.temperature || ''
        },
        assessment: deliveryData.miscarriage_info?.assessment || '',
        management: deliveryData.miscarriage_info?.management || '',
        referral: deliveryData.miscarriage_info?.referral || '',
        notes: deliveryData.miscarriage_info?.notes || ''
      };

      const { data: miscarriagePregnancy, error: miscarriageInsertError } = await supabase
        .from('pregnancy_info')
        .insert({
          patient_id: deliveryData.mother_id,
          created_by: createdBy,
          pregn_postp: null,
          lmd: currentPregnancy.lmd,
          edd: currentPregnancy.edd,
          pregnancy_type: currentPregnancy.pregnancy_type,
          place_of_delivery: null,
          gravida: (currentPregnancy.gravida || 0) + 1,
          para: currentPregnancy.para || 0,
          miscarriage_info: miscarriageInfo
        })
        .select('id')
        .single();

      if (miscarriageInsertError) throw miscarriageInsertError;

      return {
        delivery_id: null,
        pregnancy_id: miscarriagePregnancy.id,
        newborn_ids: [],
        miscarriage: true
      };
    }

    const attendingStaffId = deliveryId
      ? deliveryData.attending_staff || deliveryData.attendingStaffId || null
      : createdBy;
    if (!attendingStaffId) throw new Error('Select the staff member who attended the delivery.');

    const { data: pregnancyRows, error: pregnancyRowsError } = await supabase
      .from('pregnancy_info')
      .select('id, patient_id, pregn_postp, lmd, edd, pregnancy_type, place_of_delivery, gravida, para, miscarriage_info, created_at')
      .eq('patient_id', deliveryData.mother_id)
      .order('created_at', { ascending: false });
    if (pregnancyRowsError) throw pregnancyRowsError;

    let existingPregnancyId = deliveryData.pregnancy_id || null;
    if (deliveryId && !existingPregnancyId) {
      const { data: existingDelivery, error: existingDeliveryError } = await supabase
        .from('deliveries')
        .select('pregnancy_id')
        .eq('id', deliveryId)
        .maybeSingle();
      if (existingDeliveryError) throw existingDeliveryError;
      existingPregnancyId = existingDelivery?.pregnancy_id || null;
    }

    const deliveryPregnancy = getPregnancyForDelivery(
      pregnancyRows || [],
      deliveryData.delivery_date,
      existingPregnancyId,
      deliveryData.delivery_time
    ) || (existingPregnancyId ? { id: existingPregnancyId } : null);
    if (!deliveryPregnancy) {
      throw new Error('Could not match this delivery to a pregnancy record. Verify the mother and pregnancy dates.');
    }
    const latestPregnancy = getLatestPregnancyRecord(pregnancyRows || []);

    const newbornArray = Array.isArray(newbornData) ? newbornData : [newbornData];

    const complications = Array.isArray(deliveryData.complications)
      ? deliveryData.complications.filter(c => c && c !== 'None')
      : [];

    const deliveryPayload = {
      mother_id: deliveryData.mother_id,
      station_ass: deliveryStationId,
      pregnancy_id: deliveryPregnancy.id,
      delivery_date: deliveryData.delivery_date,
      delivery_time: deliveryData.delivery_time || '00:00',
      delivery_type: deliveryData.delivery_type,
      delivery_mode: deliveryData.delivery_mode || null,
      gestational_age: deliveryData.gestational_age || null,
      risk_level: deliveryData.risk_level || 'Normal',
      complications,
      attending_staff: attendingStaffId,
      notes: deliveryData.notes || null,
      created_by: createdBy
    };

    let delivery;
    if (deliveryId) {
      // Update existing delivery
      const { data: updatedDelivery, error: deliveryError } = await supabase
        .from('deliveries')
        .update(deliveryPayload)
        .eq('id', deliveryId)
        .select('id')
        .single();

      if (deliveryError) throw deliveryError;
      delivery = updatedDelivery;
      console.log('✅ Updated delivery with ID:', deliveryId);
    } else {
      // Insert new delivery
      const { data: newDelivery, error: deliveryError } = await supabase
        .from('deliveries')
        .insert([deliveryPayload])
        .select('id')
        .single();

      if (deliveryError) throw deliveryError;
      delivery = newDelivery;
    }

    // Handle newborns
    let newbornIds = [];
    if (deliveryId && newbornArray.length > 0) {
      // Update existing newborns (assuming first newborn for simplicity)
      const newborn = newbornArray[0];
      const { data: existingNewborns } = await supabase
        .from('newborns')
        .select('id')
        .eq('delivery_id', deliveryId)
        .limit(1);

      if (existingNewborns && existingNewborns.length > 0) {
        const newbornId = existingNewborns[0].id;
        const newbornUpdate = {
          baby_name: newborn.baby_name || null,
          gender: newborn.gender,
          birth_weight: newborn.birth_weight || null,
          birth_length: newborn.birth_length || null,
          head_circumference: newborn.head_circumference || null,
          apgar_1min: newborn.apgar_1min || null,
          apgar_5min: newborn.apgar_5min || null,
          condition_at_birth: newborn.condition_at_birth || 'Healthy',
          risk_level: newborn.risk_level || 'Normal'
        };

        const { error: updateError } = await supabase
          .from('newborns')
          .update(newbornUpdate)
          .eq('id', newbornId);

        if (updateError) throw updateError;
        newbornIds = [newbornId];
        console.log('✅ Updated newborn with ID:', newbornId);
      }
    } else {
      // Insert new newborns
      const newbornInserts = newbornArray.map(newborn => ({
        delivery_id: delivery.id,
        mother_id: deliveryData.mother_id,
        baby_name: newborn.baby_name || null,
        gender: newborn.gender,
        birth_weight: newborn.birth_weight || null,
        birth_length: newborn.birth_length || null,
        head_circumference: newborn.head_circumference || null,
        apgar_1min: newborn.apgar_1min || null,
        apgar_5min: newborn.apgar_5min || null,
        condition_at_birth: newborn.condition_at_birth || 'Healthy',
        risk_level: newborn.risk_level || 'Normal',
        created_by: createdBy
      }));

      const { data: insertedNewborns, error: newbornError } = await supabase
        .from('newborns')
        .insert(newbornInserts)
        .select('id');

      if (newbornError) throw newbornError;
      newbornIds = insertedNewborns.map(n => n.id);
      console.log('✅ Inserted newborns with IDs:', newbornIds);
    }

    // Transition only the current pregnancy; historical deliveries must not change current state.
    if (
      !deliveryId
      && latestPregnancy?.id === deliveryPregnancy.id
      && String(latestPregnancy.pregn_postp || '').toLowerCase() === 'pregnant'
    ) {
        const currentPregnancy = deliveryPregnancy;
        // Calculate new gravida and para values
        const newGravida = (currentPregnancy.gravida || 1) + 1;
        const newPara = (currentPregnancy.para || 0) + 1;
        
        const { error: postpartumInsertError } = await supabase
          .from('pregnancy_info')
          .insert({
            patient_id: deliveryData.mother_id,
            created_by: createdBy,
            pregn_postp: 'Postpartum',
            lmd: currentPregnancy.lmd,
            edd: currentPregnancy.edd,
            pregnancy_type: currentPregnancy.pregnancy_type,
            place_of_delivery: deliveryData.facility || currentPregnancy.place_of_delivery,
            gravida: newGravida,
            para: newPara
          });
        if (postpartumInsertError) throw postpartumInsertError;

        // Reconcile only visits belonging to this delivery's pregnancy.
        const { data: scheduledVisits, error: visitsError } = await supabase
          .from('prenatal_visits')
          .select('id, visit_date, status, next_appt_type, missed_reason')
          .eq('patient_id', deliveryData.mother_id)
          .eq('status', 'Scheduled');
        if (visitsError) throw visitsError;

        const deliveryPregnancyHistory = buildPregnancyHistory(
          pregnancyRows || [],
          scheduledVisits || [],
          [{ ...deliveryPayload, id: delivery.id }]
        );
        const deliveryPregnancyGroup = deliveryPregnancyHistory.find(pregnancy =>
          pregnancy.deliveries.some(record => record.id === delivery.id)
        );
        const deliveryDateValue = new Date(deliveryData.delivery_date).setHours(0, 0, 0, 0);
        const staleVisitIds = (deliveryPregnancyGroup?.visits || [])
          .filter(visit => {
            if (!visit.visit_date || String(visit.next_appt_type || '').toLowerCase().includes('postpartum')) return false;
            return new Date(visit.visit_date).setHours(0, 0, 0, 0) > deliveryDateValue;
          })
          .map(visit => visit.id);

        if (staleVisitIds.length > 0) {
          const cancellationReason = 'Cancelled because delivery occurred before the scheduled prenatal visit.';
          const { error: cancellationError } = await supabase
            .from('prenatal_visits')
            .update({ status: 'Cancelled', missed_reason: cancellationReason })
            .in('id', staleVisitIds);
          if (cancellationError) {
            console.error('Could not cancel scheduled visits after delivery:', cancellationError);
          } else {
            console.log(`✅ Cancelled ${staleVisitIds.length} prenatal visits after delivery`);
          }
        }

    }

    let postpartumEmailError = null;
    if (!deliveryId) {
      const { data: postpartumEmail, error: postpartumEmailInvokeError } = await supabase.functions.invoke(
        'postpartum-delivery-email',
        { body: { delivery_id: delivery.id } }
      );
      if (postpartumEmailInvokeError) {
        postpartumEmailError = postpartumEmailInvokeError.message;
        console.error('Delivery was recorded, but postpartum email delivery failed:', postpartumEmailInvokeError);
      } else if (!postpartumEmail?.emailSent) {
        postpartumEmailError = postpartumEmail?.error || 'The postpartum schedule email was not sent.';
        console.error('Delivery was recorded, but postpartum email delivery failed:', postpartumEmailError);
      }
    }

    // NOTE: Newborn vaccine scheduling is handled separately by VaccinationService.scheduleNewbornVaccinations()
    // called from DeliveryOutcomes.jsx handleSave() to keep concerns separated

    return { delivery_id: delivery.id, newborn_ids: newbornIds, postpartumEmailError };
  }

  async getDeliveryStats() {
    try {
      const deliveries = await this.getAllDeliveries();

      const totalDeliveries = deliveries.length;
      const nsdCount = deliveries.filter(d => d.deliveryType === 'NSD').length;
      const csCount = deliveries.filter(d => d.deliveryType === 'CS').length;
      const complicationCount = deliveries.filter(d => d.complications && d.complications !== 'None').length;
      const highRiskCount = deliveries.filter(d => d.riskLevel === 'High Risk' || d.riskLevel === 'High').length;

      return [
        {
          label: 'Total Deliveries',
          value: totalDeliveries,
          color: 'lilac'
        },
        {
          label: 'Normal vs CS',
          value: `${nsdCount} / ${csCount}`,
          color: 'sage'
        },
        {
          label: 'Complications',
          value: complicationCount,
          color: 'orange'
        },
        {
          label: 'High-Risk Deliveries',
          value: highRiskCount,
          color: 'rose'
        }
      ];
    }
    catch (error) {
      console.error('Error in getDeliveryStats:', error);
      return [
        { label: 'Total Deliveries', value: 0, color: 'lilac' },
        { label: 'Normal vs CS', value: '0 / 0', color: 'sage' },
        { label: 'Complications', value: 0, color: 'orange' },
        { label: 'High-Risk Deliveries', value: 0, color: 'rose' }
      ];
    }
  }

  async getStations() {
    try {
        const { data, error } = await supabase
            .from('stations')
            .select('id, station_name')
            .not('station_name', 'is', null)
            .order('station_name', { ascending: true });

        if (error) throw error;

        const names = (data || []).map(s => s.station_name).filter(Boolean);
        return ['All Stations', ...new Set(names)];
    } catch (error) {
        console.error('Error loading stations:', error);
        return ['All Stations'];
    }
  }

  async getStaffForStation(station) {
    try {
        const { data, error } = await supabase
            .from('staff_profiles')
            .select('id, full_name, station_ass')
            .order('full_name');
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error getting staff for station:', error);
        return [];
    }
  }

  async getAllStaff() {
    try {
        const { data, error } = await supabase
            .from('staff_profiles')
            .select('id, full_name, station_ass')
            .order('full_name');
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error getting all staff:', error);
        return [];
    }
  }

  /**
   * Get detailed postpartum records for mothers
   */
  async getPostpartumRecords() {
    try {
        const { data: deliveries, error } = await supabase
            .from('deliveries')
            .select(`
                id, 
                mother_id, 
              station_ass,
                delivery_date, 
                delivery_type, 
                complications, 
                notes,
                stations:station_ass (station_name),
                patient_basic_info!deliveries_mother_id_fkey (
                    id, first_name, last_name, station_ass,
                    stations:station_ass (station_name)
                ),
                newborns (
                    id, condition_at_birth, risk_level
                )
            `)
            .order('delivery_date', { ascending: false });

        if (error) throw error;

        const filtered = deliveries || [];
        const deliveryIds = filtered.map(delivery => delivery.id);
        const { data: postpartumVisits, error: postpartumVisitsError } = deliveryIds.length
          ? await supabase
            .from('postpartum_visits')
            .select('id, delivery_id, patient_id, visit_type, scheduled_at, status, attended_date, assigned_staff, personnel_present, performed_by, assessment, notes')
            .in('delivery_id', deliveryIds)
            .order('scheduled_at', { ascending: true })
          : { data: [], error: null };
        if (postpartumVisitsError) throw postpartumVisitsError;

        const performedByIds = [...new Set((postpartumVisits || [])
          .flatMap(visit => [visit.performed_by, visit.personnel_present])
          .filter(Boolean))];
        const { data: performedByProfiles, error: performedByError } = performedByIds.length
          ? await supabase
            .from('staff_profiles')
            .select('id, full_name')
            .in('id', performedByIds)
          : { data: [], error: null };
        if (performedByError) throw performedByError;
        const performedByNames = new Map((performedByProfiles || []).map(profile => [profile.id, profile.full_name]));
        const visitsByDelivery = new Map();
        (postpartumVisits || []).forEach(visit => {
          const visits = visitsByDelivery.get(visit.delivery_id) || [];
          visits.push({
            ...visit,
            status: visit.status === 'Attended'
              ? 'Completed'
              : visit.status === 'Scheduled' && new Date(visit.scheduled_at) < new Date()
                ? 'Missed'
                : visit.status,
            performedByName: performedByNames.get(visit.personnel_present) || performedByNames.get(visit.performed_by) || null
          });
          visitsByDelivery.set(visit.delivery_id, visits);
        });

        const motherIds = [...new Set(filtered.map(d => d.mother_id))];
        const { data: pregInfo } = await supabase
            .from('pregnancy_info')
            .select('patient_id, pregn_postp, created_at')
            .in('patient_id', motherIds)
            .order('created_at', { ascending: false });

        const latestPregMap = new Map();
        (pregInfo || []).forEach(row => {
            if (!row.patient_id || latestPregMap.has(row.patient_id)) return;
            latestPregMap.set(row.patient_id, row);
        });

        const { data: riskRows } = await supabase
            .from('prenatal_visits')
            .select('patient_id, calculated_risk, visit_date')
            .in('patient_id', motherIds)
            .order('visit_date', { ascending: false });

        const latestRiskMap = new Map();
        (riskRows || []).forEach(row => {
            if (!row.patient_id || latestRiskMap.has(row.patient_id)) return;
            latestRiskMap.set(row.patient_id, row.calculated_risk || 'Normal');
        });

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return filtered
            .filter(d => {
                const latestPreg = latestPregMap.get(d.mother_id) || {};
                return (latestPreg.pregn_postp || '').toLowerCase() === 'postpartum';
            })
            .map(d => {
            const mother = d.patient_basic_info;
            const scheduledVisits = visitsByDelivery.get(d.id) || [];
            const newborns = Array.isArray(d.newborns) ? d.newborns : [d.newborns].filter(Boolean);
            const preg = latestPregMap.get(d.mother_id) || {};
            const riskLevel = latestRiskMap.get(d.mother_id) || 'Normal';
            
            const deliveryDate = new Date(d.delivery_date);
            const diffTime = Math.abs(today - deliveryDate);
            const daysPP = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            // Determine recovery status
            const hasComplications = (d.complications && d.complications.length > 0) || 
                                   newborns.some(b => b.condition_at_birth === 'NICU');
            
            let recoveryStatus = 'Normal';
            if (hasComplications) recoveryStatus = 'Complication';
            else if (riskLevel === 'High Risk' || riskLevel === 'High') recoveryStatus = 'Monitoring';

            const completedVisits = scheduledVisits.filter(visit => visit.status === 'Completed');
            const outstandingVisits = scheduledVisits
              .filter(visit => visit.status !== 'Completed' && visit.status !== 'Cancelled')
              .sort((left, right) => new Date(left.scheduled_at) - new Date(right.scheduled_at));
            const nextVisit = outstandingVisits[0] || null;
            const followUpStatus = scheduledVisits.length > 0
              && completedVisits.length === scheduledVisits.filter(visit => visit.status !== 'Cancelled').length
              ? 'Completed'
              : nextVisit?.status === 'Missed'
                ? 'Missed'
                : 'Upcoming';
            const lastCompletedVisit = completedVisits
              .filter(visit => visit.attended_date)
              .sort((left, right) => new Date(right.attended_date) - new Date(left.attended_date))[0];
            const latestAssessmentVisit = completedVisits
              .filter(visit => visit.assessment && Object.keys(visit.assessment).length > 0)
              .sort((left, right) => new Date(right.attended_date || right.scheduled_at) - new Date(left.attended_date || left.scheduled_at))[0];
            const postpartumRemarks = latestAssessmentVisit
              ? {
                assessment: latestAssessmentVisit.assessment,
                personnel_present: { name: latestAssessmentVisit.performedByName || 'Not recorded' }
              }
              : null;

            return {
                id: d.id,
                patientId: mother?.id || '',
                name: `${mother?.first_name || ''} ${mother?.last_name || ''}`.trim(),
                stationId: d.station_ass || null,
                station: d.stations?.station_name || 'Unassigned',
                deliveryDate: d.delivery_date,
                deliveryType: d.delivery_type || 'NSD',
                daysPostpartum: daysPP,
                babyOutcome: newborns?.[0]?.condition_at_birth || 'Healthy',
                recoveryStatus,
                progress: Math.min(100, Math.round((daysPP / 42) * 100)),
                lastCheckup: lastCompletedVisit?.attended_date || null,
                nextFollowUp: nextVisit?.scheduled_at || 'TBD',
                visitDate: nextVisit?.scheduled_at || lastCompletedVisit?.attended_date || null,
                postpartumAttendedDate: lastCompletedVisit?.attended_date || null,
                postpartumRemarks,
                scheduledVisits,
                followUpStatus,
                complications: d.complications && d.complications.length > 0 ? d.complications.join(', ') : 'None'
            };
        });
    } catch (error) {
        console.error('Error in getPostpartumRecords:', error);
        return [];
    }
  }

  async savePostpartumVisit(visitId, visitData) {
    const assessment = visitData.remarks.assessment || {};
    const parsePositiveNumber = value => {
      const parsed = Number.parseFloat(String(value || '').replace(/[^\d.]/g, ''));
      return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    };
    const parsePositiveInteger = value => {
      const parsed = Number.parseInt(String(value || '').replace(/[^\d]/g, ''), 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    };
    const [systolic, diastolic] = String(assessment.blood_pressure || '').split('/');
    const combine = (...parts) => parts.filter(Boolean).join('; ') || null;
    const dangerSigns = [
      ['heavy_bleeding', 'Heavy bleeding'],
      ['fever_infection', 'Fever or infection'],
      ['high_blood_pressure', 'High blood pressure'],
      ['severe_headache_vision', 'Severe headache or vision problems'],
      ['wound_complications', 'Wound complications'],
      ['breast_infection', 'Breast infection'],
    ].filter(([key]) => ['yes', 'true'].includes(String(assessment[key] || '').trim().toLowerCase()))
      .map(([, label]) => label);

    const { error } = await supabase
      .from('postpartum_visits')
      .update({
        attended_date: visitData.date,
        status: 'Attended',
        personnel_present: visitData.personnelPresent || null,
        performed_by: visitData.performedBy || null,
        assessment,
        weight_kg: parsePositiveNumber(assessment.weight_kg),
        bp_systolic: parsePositiveInteger(systolic),
        bp_diastolic: parsePositiveInteger(diastolic),
        temp_c: parsePositiveNumber(assessment.temperature),
        pulse_bpm: parsePositiveInteger(assessment.pulse),
        resp_rate_cpm: parsePositiveInteger(assessment.respiratory_rate),
        uterine_involution: combine(assessment.fundal_height_involution, assessment.uterine_firmness, assessment.uterine_tenderness),
        lochia_assessment: combine(assessment.lochia_amount, assessment.lochia_color_type, assessment.lochia_clots, assessment.lochia_foul_smell),
        perineal_or_wound_condition: combine(assessment.perineal_healing, assessment.episiotomy_laceration, assessment.perineal_pain, assessment.perineal_swelling_infection),
        pain_assessment: combine(assessment.pain_location, assessment.pain_severity, assessment.pain_management),
        breast_assessment: combine(assessment.breast_condition, assessment.nipple_condition, assessment.breastfeeding_problems),
        breastfeeding_status: assessment.breastfeeding_status || null,
        urination_and_bowel_status: combine(assessment.difficulty_urinating, assessment.constipation, assessment.bowel_movement, assessment.incontinence),
        mental_health_assessment: combine(assessment.mood, assessment.anxiety_depressive_symptoms, assessment.emotional_wellbeing, assessment.support_at_home),
        danger_signs: dangerSigns.length ? dangerSigns : null,
        clinical_notes: visitData.remarks.notes || null,
        notes: visitData.remarks.notes || null,
        advice_given: assessment.advice_given || null,
        treatments_given: assessment.treatments_given || null,
        medications_review: assessment.medications_review || null,
        family_planning_counseling: assessment.family_planning_counseling || null,
        is_referred: String(assessment.is_referred || '').toLowerCase() === 'yes',
        referred_to: assessment.referred_to || null,
        referral_reason: assessment.referral_reason || null,
      })
      .eq('id', visitId);

    if (error) throw error;
  }

  /**
   * Get summary stats for postpartum dashboard
   */
  async getPostpartumStats() {
    try {
        const records = await this.getPostpartumRecords();
        const today = new Date();
        
        const recent = records.filter(r => r.daysPostpartum <= 42).length;
        const due = records.filter(r => r.followUpStatus === 'Upcoming' && r.nextFollowUp !== 'TBD').length;
        const missed = records.filter(r => r.followUpStatus === 'Missed').length;
        const complications = records.filter(r => r.recoveryStatus === 'Complication').length;
        const recovered = records.filter(r => r.daysPostpartum > 42 && r.recoveryStatus === 'Normal').length;

        // Calculate station distribution
        const stationMap = {};
        records.forEach(r => {
            const stationName = r.station && r.station !== 'N/A' && r.station !== 'Unassigned' ? r.station : 'Unassigned';
            if (!stationMap[stationName]) stationMap[stationName] = { name: stationName, total: 0, recovered: 0 };
            stationMap[stationName].total++;
            if (r.daysPostpartum > 42 && r.recoveryStatus === 'Normal') stationMap[stationName].recovered++;
        });

        return {
            summary: [
                { label: 'Recent Deliveries (42 days)', value: recent, color: 'lilac', icon: 'Baby' },
                { label: 'Due for Postpartum Visit', value: due, color: 'pink', icon: 'Calendar' },
                { label: 'Missed Follow-ups', value: missed, color: 'orange', icon: 'XCircle' },
                { label: 'With Complications', value: complications, color: 'rose', icon: 'AlertTriangle' },
                { label: 'Recovered Mothers', value: recovered, color: 'sage', icon: 'CheckCircle2' },
            ],
            stationRecovery: Object.values(stationMap).sort((a, b) => b.total - a.total)
        };
    } catch (error) {
        console.error('Error in getPostpartumStats:', error);
        return { summary: [], stationRecovery: [] };
    }
  }
}

export default BabyService;