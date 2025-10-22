export const extractCountry = (value: unknown): string | null => {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'object') {
    const country = (value as { country?: unknown }).country;
    return typeof country === 'string' ? country : null;
  }
  return null;
};
