declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
  serve?: (...args: unknown[]) => unknown;
};

declare namespace Deno {
  interface ServeHandlerInfo {
    remoteAddr: unknown;
  }
}
