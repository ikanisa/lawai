import { describe, expect, it, vi } from 'vitest';
import type { FastifyBaseLogger } from 'fastify';

import { processUploadQueue } from '../src/routes/upload/worker.js';

describe('upload ingestion worker', () => {
  const logger: FastifyBaseLogger = {
    level: 'info',
    levelVal: 30,
    version: '1',
    child: vi.fn(() => logger),
    fatal: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    silent: vi.fn(),
  } as unknown as FastifyBaseLogger;

  it('updates documents and jobs when processing succeeds', async () => {
    const jobs = [
      { id: 'job-1', org_id: 'org-1', document_id: 'doc-1', status: 'pending' },
    ];
    const jobUpdates: Array<Record<string, unknown>> = [];
    const documentUpdates: Array<Record<string, unknown>> = [];

    const supabaseMock = {
      from: vi.fn((table: string) => {
        if (table === 'upload_ingestion_jobs') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn(() => ({
                    then: (resolve: (value: { data: unknown; error: null }) => unknown) =>
                      resolve({ data: jobs, error: null }),
                  })),
                })),
              })),
            })),
            update: vi.fn((patch: Record<string, unknown>) => ({
              eq: vi.fn(() => ({
                then: (resolve: (value: { data: null; error: null }) => unknown) => {
                  jobUpdates.push(patch);
                  resolve({ data: null, error: null });
                },
              })),
            })),
          };
        }
        if (table === 'documents') {
          return {
            update: vi.fn((patch: Record<string, unknown>) => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  then: (resolve: (value: { data: null; error: null }) => unknown) => {
                    documentUpdates.push(patch);
                    resolve({ data: null, error: null });
                  },
                })),
              })),
            })),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    const processed = await processUploadQueue(supabaseMock as any, { limit: 5 }, logger);

    expect(processed).toBe(1);
    expect(jobUpdates).toHaveLength(2);
    expect(jobUpdates[0]).toMatchObject({ status: 'processing' });
    expect(jobUpdates[1]).toMatchObject({ status: 'completed' });
    expect(documentUpdates).toHaveLength(1);
    expect(documentUpdates[0]).toMatchObject({ vector_store_status: 'uploaded' });
  });

  it('marks jobs as failed when a document update throws', async () => {
    const jobs = [
      { id: 'job-2', org_id: 'org-1', document_id: 'doc-2', status: 'pending' },
    ];
    const jobUpdates: Array<Record<string, unknown>> = [];

    const supabaseMock = {
      from: vi.fn((table: string) => {
        if (table === 'upload_ingestion_jobs') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn(() => ({
                    then: (resolve: (value: { data: unknown; error: null }) => unknown) =>
                      resolve({ data: jobs, error: null }),
                  })),
                })),
              })),
            })),
            update: vi.fn((patch: Record<string, unknown>) => ({
              eq: vi.fn(() => ({
                then: (resolve: (value: { data: null; error: null }) => unknown) => {
                  jobUpdates.push(patch);
                  resolve({ data: null, error: null });
                },
              })),
            })),
          };
        }
        if (table === 'documents') {
          return {
            update: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  then: (_resolve: (value: { data: null; error: null }) => unknown) => {
                    throw new Error('document_update_failed');
                  },
                })),
              })),
            })),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    const processed = await processUploadQueue(supabaseMock as any, { limit: 1 }, logger);

    expect(processed).toBe(0);
    expect(jobUpdates.at(-1)).toMatchObject({ status: 'failed' });
  });
});
