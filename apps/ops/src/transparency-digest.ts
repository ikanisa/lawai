#!/usr/bin/env node
import {
  formatTransparencyDigest as formatSharedDigest,
  type TransparencyReport,
} from '@avocat-ai/shared/transparency';

export type TransparencyDigestRecord = TransparencyReport;

export function formatTransparencyDigest(
  reference: Date,
  reports: TransparencyDigestRecord[],
): { markdown: string; summary: string } {
  return formatSharedDigest(reference, reports);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const now = new Date();
  console.log(formatTransparencyDigest(now, []));
}
