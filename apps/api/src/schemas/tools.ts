import { z } from 'zod';

export const ToolInvocationLogSchema = z.object({
  name: z.string(),
  args: z.unknown(),
  output: z.unknown(),
});

export const ToolInvocationLogsSchema = z.array(ToolInvocationLogSchema);

