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

test('consulta estoque na rota documentada da empresa e setor', async () => {
  let requested = '';
  const f = async (input: RequestInfo | URL) => { requested = String(input); return requested.endsWith('/auth/token') ? json({ accessToken: 'a', refreshToken: 'r', expiresIn: 3600 }) : json({ Erros: [], ListaObjetos: [{ QuantidadeDisponivel: 5 }] }); };
  const c = new BimerClient(options(f as typeof fetch)); const result = await c.getStock(1, '00A0000001', '00A0000008'); assert.match(requested, /\/api\/1\/produtos\/00A0000001\/estoque\?identificadorSetor=00A0000008$/); assert.equal(result.listaObjetos.length, 1);
});

test('consultas de clientes usam somente as rotas oficiais permitidas', async () => {
  const requested: string[] = [];
  const f = async (input: RequestInfo | URL) => { const url = String(input); requested.push(url); return url.endsWith('/auth/token') ? json({ accessToken: 'a', refreshToken: 'r', expiresIn: 3600 }) : json({ Erros: [], ListaObjetos: [] }); };
  const c = new BimerClient(options(f as typeof fetch));
  await c.getCustomer('00A0000001');
  await c.getCustomerByDocumentOrExternalCode({ cpfCnpj: '01234567890' });
  await c.getCustomersByName('Cliente Teste', true);
  await c.getCustomerByCrmCode('000001');
  assert.deepEqual(requested.slice(1).map(x => new URL(x).pathname + new URL(x).search), [
    '/api/pessoas/00A0000001',
    '/api/pessoas?cpfCnpj=01234567890',
    '/api/pessoas/porNome?nome=Cliente+Teste&porTrecho=true',
    '/api/pessoas/codigo/000001'
  ]);
});

test('consulta de pedidos envia empresa fixa e preserva paginação', async () => {
  let requested = '';
  const f = async (input: RequestInfo | URL) => { requested = String(input); return requested.endsWith('/auth/token') ? json({ accessToken: 'a', refreshToken: 'r', expiresIn: 3600 }) : json({ Erros: [], ListaObjetos: [], Paginacao: { Pagina: 1 } }); };
  const c = new BimerClient(options(f as typeof fetch));
  const result = await c.getSalesOrders({ empresa: '1', status: 'A', limite: '25', pagina: '1' });
  assert.equal(new URL(requested).pathname + new URL(requested).search, '/api/venda/pedidos/status?empresa=1&status=A&limite=25&pagina=1');
  assert.equal(result.paginacao.Pagina, 1);
});
