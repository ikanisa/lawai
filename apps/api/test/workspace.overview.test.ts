import { describe, expect, it } from 'vitest';

import { buildHitlInbox } from '../src/domain/workspace/hitl.js';
import {
  collectWorkspaceFetchErrors,
  extractCountry,
  normalizeWorkspaceOverview,
  type WorkspaceOverviewQueryResults,
} from '../src/domain/workspace/overview.js';

describe('workspace overview helpers', () => {
  it('normalizes overview rows into the expected shape', () => {
    const overview = normalizeWorkspaceOverview({
      jurisdictions: [
        { code: 'FR', name: 'France', eu: true, ohada: false },
        { code: 'US', name: 'United States', eu: false, ohada: false },
      ],
      matters: [
        {
          id: 'run-1',
          question: 'What is the capital of France?',
          risk_level: 'low',
          hitl_required: false,
          status: 'completed',
          started_at: '2024-01-01T00:00:00.000Z',
          finished_at: '2024-01-01T00:01:00.000Z',
          jurisdiction_json: { country: 'FR' },
        },
        {
          id: 'run-2',
          question: 'What is the capital of the US?',
          risk_level: null,
          hitl_required: null,
          status: 'pending',
          started_at: null,
          finished_at: null,
          jurisdiction_json: { country_code: 'US' },
        },
        {
          id: 'run-3',
          question: 'Unknown jurisdiction',
          risk_level: 'high',
          hitl_required: true,
          status: 'completed',
          started_at: '2024-01-02T00:00:00.000Z',
          finished_at: '2024-01-02T00:01:00.000Z',
          jurisdiction_json: null,
        },
      ],
      compliance: [
        {
          id: 'compliance-1',
          title: 'New policy',
          publisher: 'OECD',
          source_url: 'https://example.com/policy',
          jurisdiction_code: 'FR',
          consolidated: true,
          effective_date: '2024-01-01',
          created_at: '2024-01-02',
        },
      ],
      hitl: [
        {
          id: 'hitl-1',
          run_id: 'run-1',
          reason: 'Needs review',
          status: 'pending',
          created_at: '2024-01-03T00:00:00.000Z',
        },
        {
          id: 'hitl-2',
          run_id: 'run-3',
          reason: 'Escalated',
          status: 'completed',
          created_at: '2024-01-04T00:00:00.000Z',
        },
      ],
    });

    expect(overview.jurisdictions).toEqual([
      { code: 'FR', name: 'France', eu: true, ohada: false, matterCount: 1 },
      { code: 'US', name: 'United States', eu: false, ohada: false, matterCount: 1 },
    ]);
    expect(overview.matters).toEqual([
      {
        id: 'run-1',
        question: 'What is the capital of France?',
        status: 'completed',
        riskLevel: 'low',
        hitlRequired: false,
        startedAt: '2024-01-01T00:00:00.000Z',
        finishedAt: '2024-01-01T00:01:00.000Z',
        jurisdiction: 'FR',
      },
      {
        id: 'run-2',
        question: 'What is the capital of the US?',
        status: 'pending',
        riskLevel: null,
        hitlRequired: null,
        startedAt: null,
        finishedAt: null,
        jurisdiction: 'US',
      },
      {
        id: 'run-3',
        question: 'Unknown jurisdiction',
        status: 'completed',
        riskLevel: 'high',
        hitlRequired: true,
        startedAt: '2024-01-02T00:00:00.000Z',
        finishedAt: '2024-01-02T00:01:00.000Z',
        jurisdiction: null,
      },
    ]);
    expect(overview.complianceWatch).toEqual([
      {
        id: 'compliance-1',
        title: 'New policy',
        publisher: 'OECD',
        url: 'https://example.com/policy',
        jurisdiction: 'FR',
        consolidated: true,
        effectiveDate: '2024-01-01',
        createdAt: '2024-01-02',
      },
    ]);
    expect(overview.hitlInbox).toEqual({
      items: [
        {
          id: 'hitl-1',
          runId: 'run-1',
          reason: 'Needs review',
          status: 'pending',
          createdAt: '2024-01-03T00:00:00.000Z',
        },
        {
          id: 'hitl-2',
          runId: 'run-3',
          reason: 'Escalated',
          status: 'completed',
          createdAt: '2024-01-04T00:00:00.000Z',
        },
      ],
      pendingCount: 1,
    });
  });

  it('extracts country information from heterogeneous metadata', () => {
    expect(extractCountry(null)).toBeNull();
    expect(extractCountry({ country: 'FR' })).toBe('FR');
    expect(extractCountry({ country: '  ' })).toBeNull();
    expect(extractCountry({ country_code: 'US' })).toBe('US');
    expect(extractCountry({ country_code: '   ' })).toBeNull();
    expect(extractCountry({ some: 'value' })).toBeNull();
  });

  it('collects individual query errors for logging', () => {
    const results = {
      jurisdictionsResult: { data: [], error: new Error('jurisdictions') },
      mattersResult: { data: [], error: undefined },
      complianceResult: { data: [], error: new Error('compliance') },
      hitlResult: { data: [], error: new Error('hitl') },
    } as unknown as WorkspaceOverviewQueryResults;

    expect(collectWorkspaceFetchErrors(results)).toEqual({
      jurisdictions: expect.any(Error),
      matters: undefined,
      compliance: expect.any(Error),
      hitl: expect.any(Error),
    });
  });

  it('builds the HITL inbox shape with pending counts', () => {
    const inbox = buildHitlInbox([
      { id: '1', run_id: 'r1', reason: 'Check', status: 'pending', created_at: '2024-01-01' },
      { id: '2', run_id: 'r2', reason: 'OK', status: 'completed', created_at: '2024-01-02' },
      { id: '3', run_id: 'r3', reason: 'Review', status: 'pending', created_at: null },
    ]);

    expect(inbox).toEqual({
      items: [
        { id: '1', runId: 'r1', reason: 'Check', status: 'pending', createdAt: '2024-01-01' },
        { id: '2', runId: 'r2', reason: 'OK', status: 'completed', createdAt: '2024-01-02' },
        { id: '3', runId: 'r3', reason: 'Review', status: 'pending', createdAt: null },
      ],
      pendingCount: 2,
    });
  });
});
