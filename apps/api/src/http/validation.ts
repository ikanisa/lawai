import type { ZodTypeAny } from 'zod';
import { ValidationError } from './errors.js';

export type ValidationTarget = 'query' | 'body' | 'headers' | 'params';

export function parseWithSchema<TSchema extends ZodTypeAny, TOutput = TSchema['_output']>(
  schema: TSchema,
  value: unknown,
  target: ValidationTarget,
): TOutput {
  const result = schema.safeParse(value ?? {});
  if (!result.success) {
    throw new ValidationError(target, result.error);
  }
  return result.data as TOutput;
}
