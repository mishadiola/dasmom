export const toDateValue = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

export const buildMotherScheduleItems = (patient = {}) => {
  if (!patient || typeof patient !== 'object') return [];

  const station = patient.station || 'Health Station';
  const items = [];

  const isUpcoming = (status = '') => {
    const normalized = String(status).trim().toLowerCase();
    return !normalized || normalized === 'scheduled' || normalized === 'upcoming' || normalized === 'waiting';
  };

  const addItem = (item) => {
    if (!item || !item.date) return;
    const parsedDate = toDateValue(item.date);
    if (!parsedDate) return;
    if (!isUpcoming(item.status)) return;

    const normalizedItem = {
      ...item,
      date: parsedDate.toISOString(),
      location: item.location || station,
      isAssignedByStaff: true,
      isMotherAssignment: true,
    };

    items.push(normalizedItem);
  };

  (patient.visits || []).forEach((visit) => {
    const visitDate = visit?.visit_date || visit?.date;
    if (!visitDate) return;

    addItem({
      id: visit.id || `visit-${visitDate}`,
      sourceId: visit.id || null,
      type: 'Prenatal',
      title: 'Prenatal visit',
      date: visitDate,
      time: toDateValue(visitDate)?.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) || '09:00 AM',
      status: visit.status || 'Scheduled',
      location: patient.station || 'Health Station',
      notes: visit.clinical_notes || 'Prenatal checkup',
      label: 'Prenatal visit',
    });
  });

  (patient.vaccines || []).forEach((vaccine) => {
    const vaccineDate = vaccine?.scheduled_vaccination || vaccine?.vaccinated_date;
    if (!vaccineDate) return;

    addItem({
      id: vaccine.id || `vaccine-${vaccineDate}`,
      sourceId: vaccine.id || null,
      type: 'Vaccination',
      title: vaccine.vaccine_name || vaccine.notes || 'Vaccination',
      date: vaccineDate,
      time: '',
      status: vaccine.status || 'Scheduled',
      location: patient.station || 'Health Station',
      notes: vaccine.notes || vaccine.vaccine_name || 'Vaccination',
      label: vaccine.vaccine_name || vaccine.notes || 'Vaccination',
    });
  });

  (patient.newborns || []).forEach((newborn) => {
    (newborn.vaccines || []).forEach((vaccine) => {
      const vaccineDate = vaccine?.scheduled_vaccination || vaccine?.vaccinated_date;
      if (!vaccineDate) return;

      const vaccineName = vaccine.vaccine_name || vaccine.notes || 'Vaccination';
      const babyName = newborn.baby_name || 'your baby';
      addItem({
        id: vaccine.id || `newborn-vaccine-${newborn.id || babyName}-${vaccineDate}`,
        sourceId: vaccine.id || null,
        type: 'Vaccination',
        title: `${vaccineName} for ${babyName}`,
        date: vaccineDate,
        time: '',
        status: vaccine.status || 'Scheduled',
        location: patient.station || 'Health Station',
        notes: vaccine.notes || vaccineName,
        label: `${vaccineName} for ${babyName}`,
      });
    });
  });

  (patient.deliveries || []).forEach((delivery) => {
    const postpartumDate = delivery?.postpartum_visit_date || delivery?.postpartum_attended_date;
    if (!postpartumDate) return;

    const status = delivery.postpartum_attended_date ? 'Completed' : (delivery.postpartum_visit_date ? 'Scheduled' : 'Pending');

    addItem({
      id: delivery.id || `postpartum-${postpartumDate}`,
      sourceId: delivery.id || null,
      type: 'Postpartum',
      title: 'Postpartum follow-up',
      date: postpartumDate,
      time: '',
      status,
      location: patient.station || 'Health Station',
      notes: delivery.postpartum_remarks || 'Postpartum follow-up check',
      label: 'Postpartum follow-up',
    });
  });

  return Array.from(new Map(items.map((item) => [item.id, item])).values())
    .sort((a, b) => new Date(a.date) - new Date(b.date));
};

export const getReminderDateForItem = (value) => {
  const baseDate = toDateValue(value);
  if (!baseDate) return null;

  const reminder = new Date(baseDate);
  reminder.setUTCDate(reminder.getUTCDate() - 1);
  reminder.setUTCHours(14, 0, 0, 0);
  return reminder;
};

export const formatDisplayDate = (isoDate) => {
  if (!isoDate) return '—';
  const date = toDateValue(isoDate);
  if (!date) return '—';
  return date.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
};
