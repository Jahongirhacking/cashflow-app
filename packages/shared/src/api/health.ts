export interface HealthResponse {
  status: 'ok';
  service: 'my-cashify-api';
  version: string;
  environment: string;
  timestamp: string;
  uptimeSeconds: number;
  /** Deployed git commit when the host exposes it (RENDER_GIT_COMMIT, NF_GIT_COMMIT, GIT_COMMIT). */
  commit: string | null;
}
