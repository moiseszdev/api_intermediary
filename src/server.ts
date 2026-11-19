import { loadConfig } from './config.ts'; import { BimerClient } from './bimer-client.ts'; import { RelationsRepository } from './relations.ts'; import { Store } from './store.ts'; import { Synchronizer } from './sync.ts'; import { createApp } from './app.ts';
const c = loadConfig(); const store = new Store(c.STATE_DB_PATH); store.initializeCursor(c.SYNC_INITIAL_CURSOR || undefined);
const bimer = new BimerClient({ baseUrl: c.BIMER_BASE_URL, username: c.BIMER_USERNAME, password: c.BIMER_PASSWORD, timeoutMs: c.BIMER_TIMEOUT_MS, refreshMarginMs: c.BIMER_REFRESH_MARGIN_SECONDS * 1000, expiresMultiplier: c.BIMER_EXPIRES_IN_UNIT === 'seconds' ? 1000 : 1 });
const relations = new RelationsRepository(c.ERP_SQL_CONNECTION_STRING, c.ERP_CODE_TYPE_ID); const sync = new Synchronizer(bimer, relations, store, c.SYNC_BATCH_SIZE, c.SYNC_CONCURRENCY, c.SYNC_CURSOR_SEMANTICS_CONFIRMED);
const server = createApp(c, bimer, relations, store, sync).listen(c.PORT, () => console.log(JSON.stringify({ level: 'info', message: 'server_started', port: c.PORT })));
const timer = setInterval(() => sync.runOnce().catch(e => console.error(JSON.stringify({ level: 'error', message: 'sync_failed', error: e.message }))), c.SYNC_INTERVAL_MS); timer.unref();
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { clearInterval(timer); server.close(() => { store.close(); process.exit(0); }); });
