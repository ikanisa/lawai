import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

interface TableDefinition {
  name: string;
  columns: string[];
}

function parseTables(sql: string): Record<string, TableDefinition> {
  const pattern = /create\s+table\s+if\s+not\s+exists\s+public\.(\w+)\s*\(([^;]+)\);/gi;
  const tables: Record<string, TableDefinition> = {};
  let match: RegExpExecArray | null;

  // eslint-disable-next-line no-cond-assign
  while ((match = pattern.exec(sql)) !== null) {
    const [, tableName, body] = match;
    const columns = body
      .split(/,\s*\n/)
      .map((segment) => segment.trim())
      .filter((segment) =>
        Boolean(segment) &&
        !/^primary\s+key/i.test(segment) &&
        !/^constraint/i.test(segment) &&
        !/^foreign\s+key/i.test(segment) &&
        !/^unique/i.test(segment) &&
        !/^check/i.test(segment),
      )
      .map((segment) => {
        const columnMatch = segment.match(/^"?(\w+)"?\s+/);
        return columnMatch ? columnMatch[1] : null;
      })
      .filter((columnName): columnName is string => columnName !== null);

    tables[tableName] = { name: tableName, columns };
  }

  return tables;
}

describe('admin schema compatibility', () => {
  const migrationPath = join(process.cwd(), '..', '..', 'supabase', 'migrations', '20240710120000_admin_panel.sql');
  const sql = readFileSync(migrationPath, 'utf8');
  const tables = parseTables(sql);

  const requiredColumns: Record<string, string[]> = {
    admin_policies: ['org_id', 'key', 'value', 'updated_at', 'updated_by'],
    admin_entitlements: ['org_id', 'jurisdiction', 'entitlement', 'enabled', 'updated_at'],
    admin_audit_events: ['id', 'org_id', 'actor', 'action', 'object', 'payload_before', 'payload_after', 'created_at'],
    admin_jobs: ['id', 'org_id', 'type', 'status', 'progress', 'last_error', 'payload', 'actor', 'updated_at'],
    admin_telemetry_snapshots: ['id', 'org_id', 'metric', 'value', 'collected_at', 'tags'],
    admin_users: ['id', 'org_id', 'email', 'role', 'capabilities', 'invited_at', 'last_active'],
    admin_agents: ['id', 'org_id', 'name', 'version', 'status', 'tool_count', 'promoted_at'],
    admin_workflows: ['id', 'org_id', 'name', 'version', 'status', 'draft_diff', 'updated_at', 'updated_by'],
    admin_hitl_queue: ['id', 'org_id', 'matter', 'summary', 'status', 'blast_radius', 'submitted_at'],
    admin_corpus_sources: ['id', 'org_id', 'label', 'status', 'last_synced_at', 'quarantine_count'],
    admin_ingestion_tasks: ['id', 'org_id', 'stage', 'status', 'progress', 'last_error', 'updated_at'],
    admin_evaluations: ['id', 'org_id', 'name', 'pass_rate', 'slo_gate', 'status', 'last_run_at'],
  };

  for (const [tableName, columns] of Object.entries(requiredColumns)) {
    it(`ensures ${tableName} retains critical columns`, () => {
      expect(tables).toHaveProperty(tableName);
      const definition = tables[tableName];
      const columnSet = new Set(definition.columns);
      for (const column of columns) {
        expect(columnSet.has(column)).toBe(true);
      }
    });
  }
});
