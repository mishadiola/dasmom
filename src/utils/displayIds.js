const getFirstFourDigits = (id) => {
    const digits = String(id || '').replace(/[^0-9]/g, '');
    return digits.slice(0, 4) || '0000';
};

export const formatMotherId = (id) => `MOM ${getFirstFourDigits(id)}`;
export const formatNewbornId = (id) => `NB ${getFirstFourDigits(id)}`;
