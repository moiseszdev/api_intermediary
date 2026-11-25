import test from 'node:test';
import assert from 'node:assert/strict';
import { createOpenApiSpec } from '../src/openapi.ts';
import { loadConfig } from '../src/config.ts';

const config = loadConfig({
  BIMER_BASE_URL: 'https://bimer.test', BIMER_USERNAME: 'u', BIMER_PASSWORD: 'p',
  ERP_SQL_CONNECTION_STRING: 'Server=test;Database=test;User Id=test;Password=test',
  API_KEYS_SHA256: '0'.repeat(64)
});

test('OpenAPI publica todas as consultas autorizadas e nenhuma escrita de negócio', () => {
  const spec = createOpenApiSpec(config);
  const expected = [
    '/api/clientes', '/api/clientes/por-nome', '/api/clientes/codigo/{codigoCRM}', '/api/clientes/{identificador}',
    '/api/pedidos-venda', '/api/pedidos-venda/{identificador}', '/api/produtos', '/api/produtos/{identificador}',
    '/api/produtos/{identificador}/preco', '/api/produtos/{identificador}/estoques'
  ];
  for (const path of expected) assert.ok(path in spec.paths, `rota ausente: ${path}`);
  for (const [path, operations] of Object.entries(spec.paths)) {
    if (!path.startsWith('/api/')) continue;
    assert.deepEqual(Object.keys(operations), ['get'], `método não permitido em ${path}`);
  }
  assert.equal(spec.info.version, '1.1.0');
});
