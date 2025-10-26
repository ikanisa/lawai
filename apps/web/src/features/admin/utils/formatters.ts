export const numberFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

export const decimalFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

const dateTimeFormatter = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' });

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${decimalFormatter.format(value * 100)} %`;
}

export function formatMinutes(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${decimalFormatter.format(value)} min`;
}

export function formatSeconds(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${decimalFormatter.format(value)} s`;
}

export function formatPercentValue(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${decimalFormatter.format(value)} %`;
}

export function formatDecimal(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return decimalFormatter.format(value);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return dateTimeFormatter.format(date);
}
