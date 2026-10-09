export interface HealthResponse {
  status: 'ok';
  service: 'my-cashify-api';
  version: string;
  environment: string;
  timestamp: string;
  uptimeSeconds: number;
}
