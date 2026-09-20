export interface Bindings {
  DB: D1Database;
  BUCKET: R2Bucket;
  ASSETS?: Fetcher;
  SITE_ORIGIN?: string;
  ENVIRONMENT?: string;
  ACCESS_ISSUER?: string;
  ACCESS_AUDIENCE?: string;
  ACCESS_OWNER_SUBJECTS?: string;
  CSRF_SECRET?: string;
  ADMIN_RATE_LIMITER?: {
    limit(options: { key: string }): Promise<{ success: boolean }>;
  };
}
export type AppEnv = {
  Bindings: Bindings;
  Variables: { owner: string; csrf: string; nonce: string };
};
