import pLimit from 'p-limit';
import type { BimerClient } from './bimer-client.ts';
import type { RelationsRepository } from './relations.ts';
import type { Store } from './store.ts';
import { syncLag, syncRuns } from './metrics.ts';

export class Synchronizer {
  private running = false;
  constructor(private bimer: BimerClient, private relations: RelationsRepository, private store: Store, private batchSize: number, private concurrency: number, private semanticsConfirmed: boolean) {}
  async runOnce() {
    if (this.running) return { skipped: 'already-running' }; const cursor = this.store.getCursor();
    if (!cursor) return { skipped: 'initial-cursor-required' };
    if (!this.semanticsConfirmed) return { skipped: 'cursor-semantics-not-confirmed' };
    this.running = true;
    try {
      const changed = await this.bimer.getChanged(cursor, this.batchSize); const page = changed.listaObjetos[0];
      if (!page) throw new Error('Resposta incremental sem página');
      const ids = [...new Set((page.registros ?? []).map(String))] as string[]; if (!ids.length) { syncRuns.inc({ result: 'empty' }); return { processed: 0, cursor }; }
      const next = String(page.maiorVersaoRegistro); if (!/^\d+$/.test(next) || BigInt(next) <= BigInt(cursor)) throw new Error('Cursor não avançou com lote não vazio');
      const limit = pLimit(this.concurrency); const envelopes = await Promise.all(ids.map(id => limit(() => this.bimer.getProduct(id))));
      const relations = await this.relations.getMany(ids);
      const products = envelopes.map((env, i) => { const id = ids[i]!; return { id, envelope: { ...env, listaObjetos: env.listaObjetos.map((p: any) => ({ ...p, ...(relations.get(id)!) })) } }; });
      this.store.commitBatch(products, next); syncRuns.inc({ result: 'success' }); syncLag.set(Date.now() / 1000); return { processed: ids.length, cursor: next };
    } catch(e) { syncRuns.inc({ result: 'failure' }); throw e; } finally { this.running = false; }
  }
}
