export const extractCountry = (value) => {
    if (!value) {
        return null;
    }
    if (typeof value === 'string') {
        return value;
    }
    if (typeof value === 'object') {
        const country = value.country;
        return typeof country === 'string' ? country : null;
    }
    return null;
};
