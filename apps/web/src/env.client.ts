import { z } from 'zod';

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().default('http://localhost:54321'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).default('public-anon-key'),
  NEXT_PUBLIC_API_BASE_URL: z.string().url().default('http://localhost:3333'),
  NEXT_PUBLIC_DASHBOARD_RUNS_HIGH: z.coerce.number().default(1000),
  NEXT_PUBLIC_DASHBOARD_RUNS_MEDIUM: z.coerce.number().default(200),
  NEXT_PUBLIC_EVAL_PASS_GOOD: z.coerce.number().default(0.9),
  NEXT_PUBLIC_EVAL_PASS_OK: z.coerce.number().default(0.75),
  NEXT_PUBLIC_EVAL_COVERAGE_GOOD: z.coerce.number().default(0.9),
  NEXT_PUBLIC_EVAL_COVERAGE_OK: z.coerce.number().default(0.75),
  NEXT_PUBLIC_EVAL_MAGHREB_GOOD: z.coerce.number().default(0.95),
  NEXT_PUBLIC_EVAL_MAGHREB_OK: z.coerce.number().default(0.8),
  NEXT_PUBLIC_TOOL_FAILURE_WARN: z.coerce.number().default(0.02),
  NEXT_PUBLIC_TOOL_FAILURE_CRIT: z.coerce.number().default(0.05),
});

export const clientEnv = clientSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  NEXT_PUBLIC_DASHBOARD_RUNS_HIGH: process.env.NEXT_PUBLIC_DASHBOARD_RUNS_HIGH,
  NEXT_PUBLIC_DASHBOARD_RUNS_MEDIUM: process.env.NEXT_PUBLIC_DASHBOARD_RUNS_MEDIUM,
  NEXT_PUBLIC_EVAL_PASS_GOOD: process.env.NEXT_PUBLIC_EVAL_PASS_GOOD,
  NEXT_PUBLIC_EVAL_PASS_OK: process.env.NEXT_PUBLIC_EVAL_PASS_OK,
  NEXT_PUBLIC_EVAL_COVERAGE_GOOD: process.env.NEXT_PUBLIC_EVAL_COVERAGE_GOOD,
  NEXT_PUBLIC_EVAL_COVERAGE_OK: process.env.NEXT_PUBLIC_EVAL_COVERAGE_OK,
  NEXT_PUBLIC_EVAL_MAGHREB_GOOD: process.env.NEXT_PUBLIC_EVAL_MAGHREB_GOOD,
  NEXT_PUBLIC_EVAL_MAGHREB_OK: process.env.NEXT_PUBLIC_EVAL_MAGHREB_OK,
  NEXT_PUBLIC_TOOL_FAILURE_WARN: process.env.NEXT_PUBLIC_TOOL_FAILURE_WARN,
  NEXT_PUBLIC_TOOL_FAILURE_CRIT: process.env.NEXT_PUBLIC_TOOL_FAILURE_CRIT,
});
