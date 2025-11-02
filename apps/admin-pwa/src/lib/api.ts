import { queryOptions } from '@tanstack/react-query';

type Trend = {
  id: string;
  label: string;
  value: number;
  target: number;
  unit: string;
};

type Incident = {
  id: string;
  title: string;
  severity: 'low' | 'medium' | 'high';
  openedAt: string;
  owner: string;
};

type AuditEvent = {
  id: string;
  name: string;
  status: 'complete' | 'in_progress';
  updatedAt: string;
};

type Deployment = {
  id: string;
  service: string;
  version: string;
  queuedAt: string;
  status: 'queued' | 'running' | 'complete';
};

const trends: Trend[] = [
  { id: 'sla', label: 'SLA compliance', value: 97.2, target: 96, unit: '%' },
  { id: 'latency', label: 'Median response time', value: 1.2, target: 1.5, unit: 's' },
  { id: 'access', label: 'Access reviews', value: 100, target: 100, unit: '%' },
];

const incidents: Incident[] = [
  {
    id: 'ic-442',
    title: 'Staging Vercel env missing revalidation hook',
    severity: 'medium',
    openedAt: '2024-10-11T15:22:00-07:00',
    owner: 'Platform',
  },
  {
    id: 'ic-448',
    title: 'Stripe webhook retries at edge',
    severity: 'low',
    openedAt: '2024-10-11T13:05:00-07:00',
    owner: 'Payments',
  },
];

const auditEvents: AuditEvent[] = [
  {
    id: 'au-100',
    name: 'HIPAA workforce attestation',
    status: 'complete',
    updatedAt: '2024-10-10T08:30:00-07:00',
  },
  {
    id: 'au-101',
    name: 'SOC 2 control evidence refresh',
    status: 'in_progress',
    updatedAt: '2024-10-11T11:45:00-07:00',
  },
];

const deployments: Deployment[] = [
  {
    id: 'dep-771',
    service: 'Justice orchestrator',
    version: '2024.10.12-canary',
    queuedAt: '2024-10-11T22:35:00-07:00',
    status: 'queued',
  },
  {
    id: 'dep-769',
    service: 'Identity edge worker',
    version: '2024.10.11-stable',
    queuedAt: '2024-10-11T18:10:00-07:00',
    status: 'running',
  },
];

function delay<T>(value: T, ms = 220) {
  return new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));
}

export async function fetchTrends() {
  return delay(trends, 120);
}

export async function fetchIncidents() {
  return delay(incidents, 160);
}

export async function fetchAuditEvents() {
  return delay(auditEvents, 160);
}

export async function fetchDeployments() {
  return delay(deployments, 140);
}

export function trendsQueryOptions() {
  return queryOptions({
    queryKey: ['trends'] as const,
    queryFn: fetchTrends,
  });
}

export function incidentsQueryOptions() {
  return queryOptions({
    queryKey: ['incidents'] as const,
    queryFn: fetchIncidents,
  });
}

export function auditsQueryOptions() {
  return queryOptions({
    queryKey: ['audit-events'] as const,
    queryFn: fetchAuditEvents,
  });
}

export function deploymentsQueryOptions() {
  return queryOptions({
    queryKey: ['deployments'] as const,
    queryFn: fetchDeployments,
  });
}

export type { Trend, Incident, AuditEvent, Deployment };
