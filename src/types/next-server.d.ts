declare module 'next/dist/server/next.js' {
  import type { IncomingMessage, ServerResponse } from 'http';

  export type NextServerOptions = {
    dev?: boolean;
    dir?: string;
    conf?: Record<string, unknown>;
    quiet?: boolean;
    hostname?: string;
    port?: number;
  };

  export type RequestHandler = (
    req: IncomingMessage,
    res: ServerResponse,
    parsedUrl?: unknown,
  ) => Promise<void>;

  export type NextServer = {
    prepare: () => Promise<void>;
    getRequestHandler: () => RequestHandler;
  };

  const createServer: (options: NextServerOptions) => NextServer;
  export default createServer;
}
