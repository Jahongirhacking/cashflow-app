export interface HealthResponse {
  status: 'ok';
  service: 'finance-api';
  version: string;
  environment: string;
  timestamp: string;
  uptimeSeconds: number;
}
