import test from 'node:test';
import assert from 'node:assert/strict';
import { BimerClient } from '../src/bimer-client.ts';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const options = (fetchFn: typeof fetch) => ({ baseUrl: 'https://bimer.test', username: 'u', password: 'p', timeoutMs: 1000, refreshMarginMs: 100, expiresMultiplier: 1000, fetchFn });

test('requisições concorrentes fazem apenas um login/renovação', async () => {
  let logins = 0;
  const f = async (input: RequestInfo | URL) => { const url = String(input); if (url.endsWith('/auth/token')) { logins++; await new Promise(r => setTimeout(r, 10)); return json({ accessToken: 'a', refreshToken: 'r', expiresIn: 3600, tokenType: 'Bearer' }); } return json({ erros: [], listaObjetos: [] }); };
  const c = new BimerClient(options(f as typeof fetch)); await Promise.all([c.getProduct('00A0000001'), c.getProduct('00A0000002')]); assert.equal(logins, 1);
});

test('refresh inválido cai para novo login', async () => {
  let logins = 0; let refreshes = 0;
  const f = async (input: RequestInfo | URL) => { const url = String(input); if (url.endsWith('/auth/token')) return json({ accessToken: `a${++logins}`, refreshToken: 'r', expiresIn: logins === 1 ? 0 : 3600 }); if (url.endsWith('/auth/refresh-token')) { refreshes++; return json({}, 400); } return json({ erros: [], listaObjetos: [] }); };
  const c = new BimerClient(options(f as typeof fetch)); await c.getProduct('00A0000001'); await c.getProduct('00A0000001'); assert.equal(refreshes, 1); assert.equal(logins, 2);
});

test('401 provoca uma única recuperação e uma única repetição', async () => {
  let calls = 0; let logins = 0;
  const f = async (input: RequestInfo | URL) => { const url = String(input); if (url.endsWith('/auth/token')) { logins++; return json({ accessToken: `a${logins}`, refreshToken: 'r', expiresIn: 3600 }); } if (url.includes('/api/produtos/')) return ++calls === 1 ? json({}, 401) : json({ erros: [], listaObjetos: [] }); return json({}); };
  const c = new BimerClient(options(f as typeof fetch)); await c.getProduct('00A0000001'); assert.equal(calls, 2); assert.equal(logins, 2);
});

test('erro de negócio em HTTP 200 não vira sucesso vazio', async () => {
  const f = async (input: RequestInfo | URL) => String(input).endsWith('/auth/token') ? json({ accessToken: 'a', refreshToken: 'r', expiresIn: 3600 }) : json({ erros: [{ mensagem: 'negado' }], listaObjetos: [] });
  const c = new BimerClient(options(f as typeof fetch)); await assert.rejects(c.getProduct('00A0000001'), /erros de negócio/);
});

test('aceita envelope PascalCase da instalação real e normaliza a saída', async () => {
  const f = async (input: RequestInfo | URL) => String(input).endsWith('/auth/token') ? json({ accessToken: 'a', refreshToken: 'r', expiresIn: 3600 }) : json({ Erros: [], ListaObjetos: [{ Identificador: '00A0000001' }] });
  const c = new BimerClient(options(f as typeof fetch)); const result = await c.getProduct('00A0000001'); assert.deepEqual(Object.keys(result), ['erros', 'listaObjetos']); assert.equal(result.listaObjetos.length, 1);
});
