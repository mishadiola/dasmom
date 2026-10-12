export const numberPrenatalVisitsChronologically = visits => [...(visits || [])]
  .sort((left, right) => {
    const dateOrder = String(left.visit_date || '').slice(0, 10)
      .localeCompare(String(right.visit_date || '').slice(0, 10));
    if (dateOrder !== 0) return dateOrder;

    const createdAtOrder = String(left.created_at || '').localeCompare(String(right.created_at || ''));
    if (createdAtOrder !== 0) return createdAtOrder;
    return String(left.id || '').localeCompare(String(right.id || ''));
  })
  .map((visit, index) => ({ ...visit, visit_number: index + 1 }));
