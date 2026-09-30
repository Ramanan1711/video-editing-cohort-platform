// Ambient type definitions for Supabase Edge Functions (Deno Runtime)
// Provides TypeScript IDE editor support without requiring the Deno VS Code extension.

declare namespace Deno {
  const env: {
    get(key: string): string | undefined;
    set(key: string, value: string): void;
    has(key: string): boolean;
    delete(key: string): void;
  };

  interface ServeHandlerInfo {
    remoteAddr: {
      transport: 'tcp' | 'udp';
      hostname: string;
      port: number;
    };
  }

  type ServeHandler = (
    req: Request,
    info?: ServeHandlerInfo
  ) => Response | Promise<Response>;

  function serve(handler: ServeHandler): void;
}

declare module 'https://esm.sh/@supabase/supabase-js@2.39.8' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function createClient(supabaseUrl: string, supabaseKey: string, options?: any): any;
}

declare module 'https://esm.sh/@supabase/supabase-js*' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function createClient(supabaseUrl: string, supabaseKey: string, options?: any): any;
}
