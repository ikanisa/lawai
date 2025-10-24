declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
  serve?: (...args: any[]) => any;
};

declare namespace Deno {
  interface ServeHandlerInfo {
    remoteAddr: unknown;
  }
}
