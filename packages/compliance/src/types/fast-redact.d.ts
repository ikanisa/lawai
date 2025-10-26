declare module 'fast-redact' {
  interface FastRedactOptions {
    paths?: string[];
    censor?: unknown;
    serialize?: boolean;
  }

  type Redactor = <T extends Record<string, unknown>>(input: T) => T;

  export default function fastRedact(options?: FastRedactOptions): Redactor;
}
