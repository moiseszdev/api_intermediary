import client from 'prom-client';
client.collectDefaultMetrics();
export const syncRuns = new client.Counter({ name: 'bimer_sync_runs_total', help: 'Execuções de sincronização', labelNames: ['result'] });
export const retries = new client.Counter({ name: 'bimer_retries_total', help: 'Retries na origem' });
export const tokenRenewals = new client.Counter({ name: 'bimer_token_renewals_total', help: 'Renovações de token', labelNames: ['method'] });
export const syncLag = new client.Gauge({ name: 'bimer_sync_last_success_timestamp_seconds', help: 'Timestamp da última sincronização' });
export { client as metricsClient };
