import { queryOptions } from '@tanstack/react-query';

type Shift = {
  id: string;
  location: string;
  start: string;
  end: string;
  staffing: 'green' | 'yellow' | 'red';
  coverage: number;
};

type Announcement = {
  id: string;
  message: string;
  publishedAt: string;
};

type StaffMetric = {
  id: string;
  label: string;
  value: string;
  delta: string;
};

const shifts: Shift[] = [
  {
    id: 'am-phoenix',
    location: 'Phoenix Immigration Court',
    start: '2024-10-12T08:00:00-07:00',
    end: '2024-10-12T14:00:00-07:00',
    staffing: 'green',
    coverage: 0.92,
  },
  {
    id: 'pm-denver',
    location: 'Denver Juvenile Docket',
    start: '2024-10-12T12:00:00-06:00',
    end: '2024-10-12T18:00:00-06:00',
    staffing: 'yellow',
    coverage: 0.74,
  },
  {
    id: 'eve-boston',
    location: 'Boston Housing Clinic',
    start: '2024-10-12T16:00:00-04:00',
    end: '2024-10-12T21:00:00-04:00',
    staffing: 'green',
    coverage: 0.88,
  },
];

const announcements: Announcement[] = [
  {
    id: 'a11y-office-hours',
    message: 'Accessibility office hours start daily at 09:00 with live captioning.',
    publishedAt: '2024-10-11T16:30:00-07:00',
  },
  {
    id: 'rapid-response',
    message: 'Rapid response pod activated for Nogales detention center intake.',
    publishedAt: '2024-10-11T12:00:00-07:00',
  },
];

const metrics: StaffMetric[] = [
  {
    id: 'coverage',
    label: 'Coverage readiness',
    value: '88%',
    delta: '+6% vs. yesterday',
  },
  {
    id: 'outreach',
    label: 'Community outreach',
    value: '1,240 calls',
    delta: '+120 escalations resolved',
  },
  {
    id: 'documents',
    label: 'Documents synced',
    value: '342 packets',
    delta: 'All critical forms cached',
  },
];

function delay<T>(value: T, ms = 250) {
  return new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));
}

export async function fetchShifts() {
  return delay(shifts, 150);
}

export async function fetchAnnouncements() {
  return delay(announcements, 150);
}

export async function fetchMetrics() {
  return delay(metrics, 120);
}

export function shiftsQueryOptions() {
  return queryOptions({
    queryKey: ['shifts'] as const,
    queryFn: fetchShifts,
  });
}

export function announcementsQueryOptions() {
  return queryOptions({
    queryKey: ['announcements'] as const,
    queryFn: fetchAnnouncements,
  });
}

export function metricsQueryOptions() {
  return queryOptions({
    queryKey: ['metrics'] as const,
    queryFn: fetchMetrics,
  });
}

export type { Shift, Announcement, StaffMetric };
