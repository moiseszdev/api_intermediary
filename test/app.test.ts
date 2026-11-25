import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';

const apiKey = 'test-key';
const config = loadConfig({
  BIMER_BASE_URL: 'https://bimer.test',
  BIMER_USERNAME: 'user',
  BIMER_PASSWORD: 'password',
  ERP_SQL_CONNECTION_STRING: 'Server=test;Database=test;User Id=test;Password=test',
  API_KEYS_SHA256: createHash('sha256').update(apiKey).digest('hex'),
  PARTNER_COMPANY_CODE: '1'
});

async function withServer(bimer: object, run: (baseUrl: string) => Promise<void>) {
  const relations = { getMany: async () => new Map() };
  const store = { status: () => ({ cursor: null, lastSync: null }) };
  const sync = { runOnce: async () => ({ skipped: true }) };
  const server = createApp(config, bimer as any, relations as any, store as any, sync as any).listen(0);
  await once(server, 'listening');
  const address = server.address();
  try { await run(`http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`); }
  finally { server.close(); await once(server, 'close'); }
}

test('pedido por identificador de outra empresa não é revelado', async () => {
  await withServer({ getSalesOrder: async () => ({ erros: [], listaObjetos: [{ Identificador: '00A0000001', CodigoEmpresa: 2 }] }) }, async baseUrl => {
    const response = await fetch(`${baseUrl}/api/pedidos-venda/00A0000001`, { headers: { 'x-api-key': apiKey } });
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { erros: [{ mensagem: 'Pedido não encontrado' }], listaObjetos: [] });
  });
});

test('preço usa empresa 1 e tabela configurada sem aceitar parâmetros do consumidor', async () => {
  let args: unknown[] = [];
  await withServer({ getProductPrice: async (...received: unknown[]) => { args = received; return { erros: [], listaObjetos: [{ Valor: 4970 }] }; } }, async baseUrl => {
    const response = await fetch(`${baseUrl}/api/produtos/00A00080BZ/preco`, { headers: { 'x-api-key': apiKey } });
    assert.equal(response.status, 200);
    assert.deepEqual(args, [1, '00A00080BZ', '00A000001Q']);
  });
});
