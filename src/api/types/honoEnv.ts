import type { ApiAuthContext } from './auth/types.ts';

declare module 'hono' {
  interface ContextVariableMap {
    auth?: ApiAuthContext;
  }
}

export type {};
