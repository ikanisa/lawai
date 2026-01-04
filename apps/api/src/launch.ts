import { randomUUID } from 'node:crypto';
import { summariseSlo, type SloSnapshotRecord, type SloSummary } from './reports.js';

export interface LaunchCollateral {
  pilotOnboarding: Array<{ title: string; summary: string; url: string }>;
  pricingPacks: Array<{ name: string; tiers: string[]; url: string }>;
  transparency: Array<{ label: string; url: string; jurisdiction: string }>;
}

export interface RegulatorDigestRequest {
  jurisdiction: string;
  channel: 'email' | 'slack' | 'teams';
  frequency: 'weekly' | 'monthly';
  recipients: string[];
  topics?: string[];
  sloSnapshots?: SloSnapshotRecord[];
}

export interface RegulatorDigestEntry extends RegulatorDigestRequest {
  id: string;
  createdAt: string;
  sloSummary: SloSummary;
}

const collateral: LaunchCollateral = {
  pilotOnboarding: [
    {
      title: 'Pilot onboarding checklist',
      summary: 'Step-by-step activation covering governance controls, FRIA intake, and HITL readiness.',
      url: 'https://avocat-ai.example.com/pilot-onboarding.pdf',
    },
    {
      title: 'Maghreb launch playbook',
      summary: 'Binding-language banners, CEPEJ consents, and OHADA pre-emption requirements.',
      url: 'https://avocat-ai.example.com/maghreb-launch-guide.pdf',
    },
  ],
  pricingPacks: [
    {
      name: 'Operations & compliance pack',
      tiers: ['Ops desk', 'HITL review', 'Corpus governance'],
      url: 'https://avocat-ai.example.com/pricing/operations',
    },
    {
      name: 'Bench & analytics pack',
      tiers: ['Case reliability', 'Retrieval trust', 'Fairness analytics'],
      url: 'https://avocat-ai.example.com/pricing/analytics',
    },
  ],
  transparency: [
    {
      label: 'CEPEJ governance disclosures',
      jurisdiction: 'EU',
      url: 'https://avocat-ai.example.com/transparency/eu-cepej',
    },
    {
      label: 'OHADA / Maghreb language banner evidence',
      jurisdiction: 'OHADA',
      url: 'https://avocat-ai.example.com/transparency/ohada-language',
    },
    {
      label: 'Rwanda bilingual compliance digest',
      jurisdiction: 'Rwanda',
      url: 'https://avocat-ai.example.com/transparency/rwanda-digest',
    },
  ],
};

const digestQueue: RegulatorDigestEntry[] = [];

export function getLaunchCollateral(): LaunchCollateral {
  return collateral;
}

export function listRegulatorDigests(): RegulatorDigestEntry[] {
  return [...digestQueue].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function enqueueRegulatorDigest(request: RegulatorDigestRequest): RegulatorDigestEntry {
  const now = new Date().toISOString();
  const sloSummary = summariseSlo(request.sloSnapshots ?? []);
  const entry: RegulatorDigestEntry = {
    ...request,
    sloSummary,
    id: randomUUID(),
    createdAt: now,
  };
  digestQueue.push(entry);
  return entry;
}

export function __resetLaunchStateForTests() {
  digestQueue.length = 0;
}
