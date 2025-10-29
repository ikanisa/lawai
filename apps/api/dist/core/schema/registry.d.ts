import { z } from 'zod';
export type RegisteredSchema<TSchema extends z.ZodTypeAny = z.ZodTypeAny> = {
    name: string;
    schema: TSchema;
};
export declare function defineSchema<TSchema extends z.ZodTypeAny>(name: string, schema: TSchema): TSchema;
export declare function getSchema<TSchema extends z.ZodTypeAny = z.ZodTypeAny>(name: string): TSchema;
export declare function listSchemas(): RegisteredSchema[];
export interface GenerateSchemaTypesOptions {
    outputPath?: string;
    banner?: string;
}
export declare function generateSchemaTypes({ outputPath, banner, }?: GenerateSchemaTypesOptions): void;
export { z };
//# sourceMappingURL=registry.d.ts.map