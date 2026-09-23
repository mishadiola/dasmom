export const getScheduledVaccination = (vaccination) =>
    vaccination?.notes?.trim() || 'Scheduled vaccination';

export const getActualVaccine = (vaccination) => vaccination?.vaccine_inventory || null;

export const getVaccinatedBy = (vaccination) =>
    vaccination?.vaccinated_by_name || vaccination?.vaccinated_by || vaccination?.assigned_staff_name || vaccination?.assigned_staff || null;