#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const schemaPath = resolve(repoRoot, 'supabase', 'schema.sql');
const outputDir = resolve(repoRoot, 'packages', 'supabase', 'src', 'generated');
const outputPath = resolve(outputDir, 'database.types.ts');

const schemaContents = readFileSync(schemaPath, 'utf8');
const schemaHash = createHash('sha256').update(schemaContents).digest('hex');

const tables = parseTables(schemaContents);
const enums = parseEnums(schemaContents);

mkdirSync(outputDir, { recursive: true });
writeFileSync(outputPath, renderTypes(schemaHash, tables, enums));

function parseTables(sql) {
  const marker = 'CREATE TABLE IF NOT EXISTS public.';
  const tables = [];
  let cursor = 0;
  while (true) {
    const start = sql.indexOf(marker, cursor);
    if (start === -1) {
      break;
    }
    const nameStart = start + marker.length;
    const nameEnd = sql.indexOf('(', nameStart);
    const tableName = sql.slice(nameStart, nameEnd).trim();
    const bodyStart = nameEnd + 1;
    let depth = 1;
    let index = bodyStart;
    while (depth > 0 && index < sql.length) {
      const char = sql[index];
      if (char === '(') depth += 1;
      if (char === ')') depth -= 1;
      index += 1;
    }
    const body = sql.slice(bodyStart, index - 1);
    cursor = index;

    const columns = [];
    for (const rawLine of body.split('\n')) {
      const trimmed = rawLine.trim();
      if (!trimmed || trimmed.startsWith('--')) {
        continue;
      }
      const normalized = trimmed.replace(/,$/, '');
      if (normalized.startsWith('CONSTRAINT') || normalized.startsWith('PRIMARY KEY') || normalized.startsWith('UNIQUE') || normalized.startsWith('FOREIGN KEY') || normalized.startsWith('CHECK')) {
        continue;
      }
      const firstSpace = normalized.indexOf(' ');
      if (firstSpace === -1) {
        continue;
      }
      const columnName = normalized.slice(0, firstSpace).replaceAll('"', '');
      const rest = normalized.slice(firstSpace + 1);
      const typeInfo = extractType(rest);
      if (!typeInfo) {
        continue;
      }
      columns.push({ name: columnName, pgType: typeInfo.type, notNull: typeInfo.notNull, hasDefault: typeInfo.hasDefault });
    }
    tables.push({ name: tableName, columns });
  }
  return tables.sort((a, b) => a.name.localeCompare(b.name));
}

function parseEnums(sql) {
  const marker = 'CREATE TYPE public.';
  const enums = [];
  let cursor = 0;
  while (true) {
    const start = sql.indexOf(marker, cursor);
    if (start === -1) {
      break;
    }
    const nameStart = start + marker.length;
    const nameEnd = sql.indexOf(' AS ENUM', nameStart);
    if (nameEnd === -1) {
      break;
    }
    const enumName = sql.slice(nameStart, nameEnd).trim();
    const open = sql.indexOf('(', nameEnd);
    let depth = 1;
    let index = open + 1;
    while (depth > 0 && index < sql.length) {
      const char = sql[index];
      if (char === '(') depth += 1;
      if (char === ')') depth -= 1;
      index += 1;
    }
    const body = sql.slice(open + 1, index - 1);
    cursor = index;
    const values = body
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => value.replace(/^'/, '').replace(/'$/, '').replace(/''/g, "'"));
    enums.push({ name: enumName, values });
  }
  return enums.sort((a, b) => a.name.localeCompare(b.name));
}

function extractType(rest) {
  const segments = rest.split(' ');
  const parts = [];
  for (const segment of segments) {
    const upper = segment.toUpperCase();
    if (upper === 'DEFAULT' || upper === 'REFERENCES' || upper === 'CONSTRAINT' || upper === 'CHECK' || upper === 'UNIQUE' || upper === 'PRIMARY' || upper === 'COLLATE') {
      break;
    }
    if (upper === 'NOT' || upper === 'NULL') {
      break;
    }
    parts.push(segment);
  }
  const type = parts.join(' ');
  const restUpper = rest.toUpperCase();
  const notNull = restUpper.includes('NOT NULL');
  const hasDefault = restUpper.includes('DEFAULT');
  if (!type) {
    return null;
  }
  return { type, notNull, hasDefault };
}

function mapType(pgType) {
  const trimmed = pgType.trim();
  const array = trimmed.endsWith('[]');
  const base = array ? trimmed.slice(0, -2).trim() : trimmed;
  const normalized = base.toLowerCase();
  const stringTypes = ['text', 'uuid', 'citext', 'varchar', 'character varying', 'timestamp', 'timestamp without time zone', 'timestamp with time zone', 'timestamptz', 'date', 'time', 'time without time zone', 'time with time zone', 'bytea', 'name', 'ltree'];
  const numberTypes = ['integer', 'int', 'int4', 'smallint', 'real', 'double precision'];
  const booleanTypes = ['boolean'];
  const jsonTypes = ['json', 'jsonb'];
  const bigintTypes = ['bigint', 'int8'];
  const numericTypes = ['numeric', 'decimal', 'money'];

  let tsType = 'unknown';
  let zodType = 'z.unknown()';

  const matchesList = (list) => list.some((type) => normalized === type || normalized.startsWith(type + '('));

  if (matchesList(stringTypes)) {
    tsType = 'string';
    zodType = 'z.string()';
  } else if (matchesList(numberTypes)) {
    tsType = 'number';
    zodType = 'z.number()';
  } else if (matchesList(booleanTypes)) {
    tsType = 'boolean';
    zodType = 'z.boolean()';
  } else if (matchesList(jsonTypes)) {
    tsType = 'Json';
    zodType = 'jsonSchema';
  } else if (matchesList(bigintTypes) || matchesList(numericTypes)) {
    tsType = 'string';
    zodType = 'z.string()';
  } else if (normalized.startsWith('vector')) {
    tsType = 'number[]';
    zodType = 'z.array(z.number())';
  }

  if (array) {
    tsType = tsType + '[]';
    zodType = 'z.array(' + zodType + ')';
  }

  return { tsType, zodType };
}

function renderTypes(hash, tables, enums) {
  const lines = [];
  lines.push('// THIS FILE IS AUTO-GENERATED. DO NOT EDIT MANUALLY.');
  lines.push('// Generated by scripts/generate-supabase-types.mjs on ' + new Date().toISOString());
  lines.push('// Source: supabase/schema.sql');
  lines.push('');
  lines.push("import { z } from 'zod';");
  lines.push('');
  lines.push('export type Json =');
  lines.push('  | string');
  lines.push('  | number');
  lines.push('  | boolean');
  lines.push('  | null');
  lines.push('  | { [key: string]: Json | undefined }');
  lines.push('  | Json[];');
  lines.push('');
  lines.push("export const SUPABASE_SCHEMA_HASH = 'sha256-" + hash + "' as const;");
  lines.push('');
  lines.push('const jsonSchema = z.lazy(() => z.union([z.string(), z.number(), z.boolean(), z.null(), z.record(jsonSchema), z.array(jsonSchema)]));');
  lines.push('');

  for (const enumDef of enums) {
    const constName = toConst(enumDef.name) + '_VALUES';
    const literalValues = enumDef.values.map((value) => '"' + value.replace(/"/g, '\\"') + '"').join(', ');
    lines.push('export const ' + constName + ' = [' + literalValues + '] as const;');
    const typeName = toPascal(enumDef.name);
    lines.push('export type ' + typeName + ' = typeof ' + constName + '[number];');
    lines.push('export const ' + enumDef.name + 'Schema = z.enum(' + constName + ');');
    lines.push('');
  }

  for (const table of tables) {
    const pascal = toPascal(table.name);
    lines.push('export type ' + pascal + 'Row = {');
    for (const column of table.columns) {
      const mapped = mapType(column.pgType);
      const typeExpr = column.notNull ? mapped.tsType : mapped.tsType + ' | null';
      lines.push('  ' + column.name + ': ' + typeExpr + ';');
    }
    lines.push('};');
    lines.push('');

    lines.push('export type ' + pascal + 'Insert = {');
    for (const column of table.columns) {
      const mapped = mapType(column.pgType);
      const baseType = column.notNull ? mapped.tsType : mapped.tsType + ' | null';
      const optional = (!column.notNull || column.hasDefault) ? '?' : '';
      lines.push('  ' + column.name + optional + ': ' + baseType + ';');
    }
    lines.push('};');
    lines.push('');

    lines.push('export type ' + pascal + 'Update = {');
    for (const column of table.columns) {
      const mapped = mapType(column.pgType);
      const baseType = column.notNull ? mapped.tsType : mapped.tsType + ' | null';
      lines.push('  ' + column.name + '?: ' + baseType + ';');
    }
    lines.push('};');
    lines.push('');

    lines.push('export const ' + table.name + 'RowSchema = z.object({');
    for (const column of table.columns) {
      const mapped = mapType(column.pgType);
      const schemaExpr = column.notNull ? mapped.zodType : mapped.zodType + '.nullable()';
      lines.push('  ' + column.name + ': ' + schemaExpr + ',');
    }
    lines.push('});');
    lines.push('');

    lines.push('export const ' + table.name + 'InsertSchema = z.object({');
    for (const column of table.columns) {
      const mapped = mapType(column.pgType);
      let schemaExpr = column.notNull ? mapped.zodType : mapped.zodType + '.nullable()';
      if (!column.notNull || column.hasDefault) {
        schemaExpr = schemaExpr + '.optional()';
      }
      lines.push('  ' + column.name + ': ' + schemaExpr + ',');
    }
    lines.push('});');
    lines.push('');

    lines.push('export const ' + table.name + 'UpdateSchema = z.object({');
    for (const column of table.columns) {
      const mapped = mapType(column.pgType);
      let schemaExpr = column.notNull ? mapped.zodType : mapped.zodType + '.nullable()';
      schemaExpr = schemaExpr + '.optional()';
      lines.push('  ' + column.name + ': ' + schemaExpr + ',');
    }
    lines.push('});');
    lines.push('');
  }

  lines.push('export type Database = {');
  lines.push('  public: {');
  lines.push('    Tables: {');
  for (const table of tables) {
    const pascal = toPascal(table.name);
    lines.push('      ' + table.name + ': {');
    lines.push('        Row: ' + pascal + 'Row;');
    lines.push('        Insert: ' + pascal + 'Insert;');
    lines.push('        Update: ' + pascal + 'Update;');
    lines.push('      };');
  }
  lines.push('    };');
  lines.push('    Views: Record<string, never>;');
  lines.push('    Functions: Record<string, never>;');
  lines.push('    Enums: {');
  for (const enumDef of enums) {
    lines.push('      ' + enumDef.name + ': ' + toPascal(enumDef.name) + ';');
  }
  lines.push('    };');
  lines.push('    CompositeTypes: Record<string, never>;');
  lines.push('  };');
  lines.push('};');
  lines.push('');

  lines.push('export const tableSchemas = {');
  for (const table of tables) {
    lines.push('  ' + table.name + ': {');
    lines.push('    row: ' + table.name + 'RowSchema,');
    lines.push('    insert: ' + table.name + 'InsertSchema,');
    lines.push('    update: ' + table.name + 'UpdateSchema,');
    lines.push('  },');
  }
  lines.push('} as const;');
  lines.push('');
  lines.push('export type TableName = keyof typeof tableSchemas;');
  lines.push('export type TableRow<Name extends TableName> = z.infer<(typeof tableSchemas)[Name]["row"]>;');
  lines.push('export type TableInsert<Name extends TableName> = z.infer<(typeof tableSchemas)[Name]["insert"]>;');
  lines.push('export type TableUpdate<Name extends TableName> = z.infer<(typeof tableSchemas)[Name]["update"]>;');
  lines.push('');
  return lines.join('\n');
}

function toPascal(value) {
  return value
    .split(/[_\s]+/)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join('');
}

function toConst(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[-\s]/g, '_')
    .toUpperCase();
}
