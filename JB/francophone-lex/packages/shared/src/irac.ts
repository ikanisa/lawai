import { z } from 'zod';

const RuleSchema = z
  .object({
    citation: z.string(),
    source_url: z.string().url(),
    binding: z.boolean(),
    effective_date: z.string(),
    kind: z
      .enum(['statute', 'case', 'regulation', 'treaty', 'doctrine'])
      .optional()
      .default('statute'),
    eli: z.string().optional().nullable(),
    ecli: z.string().optional().nullable(),
  })
  .strict();

const ProvenanceSchema = z
  .object({
    eli: z.array(z.string()).default([]),
    ecli: z.array(z.string()).default([]),
    akoma_articles: z.number().int().nonnegative().default(0),
    feeds: z
      .array(
        z.object({
          region: z.string(),
          count: z.number().int().nonnegative(),
        }),
      )
      .default([]),
    statute_alignments: z
      .array(
        z.object({
          case_url: z.string().url(),
          statute_url: z.string().url(),
          article: z.string().nullable().optional().default(null),
          alignment_score: z.number().min(0).max(100).nullable().optional().default(null),
        }),
      )
      .default([]),
    disclosures: z
      .object({
        consent: z
          .object({
            required: z.string().nullable().optional().default(null),
            acknowledged: z.string().nullable().optional().default(null),
          })
          .default({ required: null, acknowledged: null }),
        council_of_europe: z
          .object({
            required: z.string().nullable().optional().default(null),
            acknowledged: z.string().nullable().optional().default(null),
          })
          .default({ required: null, acknowledged: null }),
        satisfied: z.boolean().default(false),
      })
      .default({
        consent: { required: null, acknowledged: null },
        council_of_europe: { required: null, acknowledged: null },
        satisfied: false,
      }),
    quarantine: z
      .object({
        flagged: z.boolean().default(false),
        reason: z.string().nullable().optional().default(null),
      })
      .default({ flagged: false, reason: null }),
  })
  .default({
    eli: [],
    ecli: [],
    akoma_articles: 0,
    feeds: [],
    statute_alignments: [],
    disclosures: {
      consent: { required: null, acknowledged: null },
      council_of_europe: { required: null, acknowledged: null },
      satisfied: false,
    },
    quarantine: { flagged: false, reason: null },
  });

export const IRACSchema = z.object({
  jurisdiction: z.object({
    country: z.string(),
    eu: z.boolean(),
    ohada: z.boolean(),
  }),
  issue: z.string(),
  rules: z.array(RuleSchema),
  application: z.string(),
  conclusion: z.string(),
  citations: z.array(
    z.object({
      title: z.string(),
      court_or_publisher: z.string(),
      date: z.string(),
      url: z.string().url(),
      note: z.string().optional().default(''),
    }),
  ),
  risk: z.object({
    level: z.enum(['LOW', 'MEDIUM', 'HIGH']),
    why: z.string(),
    hitl_required: z.boolean(),
  }),
  provenance: ProvenanceSchema,
});

export type IRACPayload = z.infer<typeof IRACSchema>;
