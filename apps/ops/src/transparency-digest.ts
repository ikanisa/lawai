#!/usr/bin/env node
import {
  formatTransparencyDigest as renderTransparencyDigest,
  type TransparencyDigestRecord,
} from '@avocat-ai/shared';

export function formatTransparencyDigest(reference: Date, reports: TransparencyDigestRecord[]): {
  markdown: string;
  summary: string;
} {
  return renderTransparencyDigest(reference, reports);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const now = new Date();
  console.log(formatTransparencyDigest(now, []));
}
