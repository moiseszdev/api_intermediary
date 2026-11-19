import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export class Store {
  private db: DatabaseSync;
  constructor(path: string) {
    mkdirSync(dirname(path), { recursive: true }); this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS products(id TEXT PRIMARY KEY, envelope TEXT NOT NULL, updated_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS checkpoints(flow TEXT PRIMARY KEY, cursor TEXT NOT NULL, updated_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS state(key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
  }
  getProduct(id: string): any | undefined { const r = this.db.prepare('SELECT envelope FROM products WHERE id=?').get(id) as any; return r ? JSON.parse(r.envelope) : undefined; }
  getCursor(): string | undefined { return (this.db.prepare("SELECT cursor FROM checkpoints WHERE flow='products'").get() as any)?.cursor; }
  initializeCursor(cursor?: string) { if (cursor && !this.getCursor()) this.db.prepare("INSERT INTO checkpoints(flow,cursor,updated_at) VALUES('products',?,?)").run(cursor, new Date().toISOString()); }
  commitBatch(products: { id: string; envelope: unknown }[], cursor: string) {
    this.db.exec('BEGIN IMMEDIATE'); try { const up = this.db.prepare('INSERT INTO products(id,envelope,updated_at) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET envelope=excluded.envelope,updated_at=excluded.updated_at'); const now = new Date().toISOString(); for (const p of products) up.run(p.id, JSON.stringify(p.envelope), now); this.db.prepare("INSERT INTO checkpoints(flow,cursor,updated_at) VALUES('products',?,?) ON CONFLICT(flow) DO UPDATE SET cursor=excluded.cursor,updated_at=excluded.updated_at").run(cursor, now); this.db.prepare("INSERT INTO state(key,value) VALUES('last_sync',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(now); this.db.exec('COMMIT'); } catch(e) { this.db.exec('ROLLBACK'); throw e; }
  }
  status() { return { cursor: this.getCursor() ?? null, lastSync: (this.db.prepare("SELECT value FROM state WHERE key='last_sync'").get() as any)?.value ?? null }; }
  close() { this.db.close(); }
}
