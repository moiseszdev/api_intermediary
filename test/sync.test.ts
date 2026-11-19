import test from 'node:test'; import assert from 'node:assert/strict'; import { Synchronizer } from '../src/sync.ts';

test('sincronização consulta somente IDs alterados e preserva int64 como texto', async () => {
  const seen: string[] = []; let commit: any;
  const bimer = { getChanged: async () => ({ listaObjetos: [{ maiorVersaoRegistro: '9223372036854775806', registros: ['00A0000001', '00A0000002'] }] }), getProduct: async (id: string) => { seen.push(id); return { erros: [], listaObjetos: [{ identificador: id, extra: true }] }; } };
  const relations = { getMany: async (ids: string[]) => new Map(ids.map(id => [id, { produtosComplementares: [], produtosEquivalentes: [] }])) };
  const store = { getCursor: () => '9223372036854775805', commitBatch: (p: unknown, c: string) => { commit = { p, c }; } };
  const result = await new Synchronizer(bimer as any, relations as any, store as any, 10, 2, true).runOnce(); assert.deepEqual(seen.sort(), ['00A0000001', '00A0000002']); assert.equal(commit.c, '9223372036854775806'); assert.equal(result.processed, 2);
});

test('falha parcial não avança cursor', async () => {
  let committed = false;
  const bimer = { getChanged: async () => ({ listaObjetos: [{ maiorVersaoRegistro: '11', registros: ['00A0000001', '00A0000002'] }] }), getProduct: async (id: string) => { if (id.endsWith('2')) throw new Error('falha'); return { listaObjetos: [] }; } };
  const store = { getCursor: () => '10', commitBatch: () => { committed = true; } };
  await assert.rejects(new Synchronizer(bimer as any, {} as any, store as any, 10, 2, true).runOnce()); assert.equal(committed, false);
});

test('sem cursor inicial não inicia carga completa', async () => {
  let called = false; const bimer = { getChanged: async () => { called = true; } }; const store = { getCursor: () => undefined };
  const result = await new Synchronizer(bimer as any, {} as any, store as any, 10, 2, true).runOnce(); assert.equal(called, false); assert.deepEqual(result, { skipped: 'initial-cursor-required' });
});
