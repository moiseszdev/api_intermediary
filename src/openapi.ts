import type { Config } from './config.ts';
import { buildInfo } from './version.ts';

const envelopeResponse = (description: string) => ({ description, content: { 'application/json': { schema: { $ref: '#/components/schemas/Envelope' } } } });
const standardResponses = (description: string) => ({
  200: envelopeResponse(description),
  400: envelopeResponse('Parâmetro inválido'),
  401: envelopeResponse('Chave de API ausente ou inválida'),
  403: envelopeResponse('Escopo não autorizado'),
  404: envelopeResponse('Registro não encontrado'),
  429: envelopeResponse('Limite de requisições excedido'),
  502: envelopeResponse('Erro de contrato ou negócio na origem Bimer'),
  503: envelopeResponse('Origem temporariamente indisponível')
});
const identifier = { name: 'identificador', in: 'path', required: true, schema: { type: 'string', minLength: 10, maxLength: 10, pattern: '^[A-Za-z0-9]{10}$' } };

export function createOpenApiSpec(c: Config) {
  return {
    openapi: '3.0.3',
    info: {
      title: 'API intermediária Bimer',
      version: buildInfo.version,
      description: `API de leitura restrita. Empresa ${c.PARTNER_COMPANY_CODE}; tabela ${c.PRICE_TABLE_CODE} (${c.PRICE_TABLE_ID}); setor ${c.STOCK_SECTOR_IDS}.`
    },
    tags: [
      { name: 'Clientes' }, { name: 'Pedidos de venda' }, { name: 'Produtos' },
      { name: 'Preços' }, { name: 'Estoque' }, { name: 'Operação' }
    ],
    components: {
      securitySchemes: { ApiKey: { type: 'apiKey', in: 'header', name: 'x-api-key' } },
      schemas: {
        Error: { type: 'object', properties: { mensagem: { type: 'string' }, correlacao: { type: 'string' } }, required: ['mensagem'] },
        Envelope: {
          type: 'object',
          properties: {
            erros: { type: 'array', items: { $ref: '#/components/schemas/Error' } },
            listaObjetos: { type: 'array', items: { type: 'object', additionalProperties: true } },
            paginacao: { type: 'object', additionalProperties: true }
          },
          required: ['erros', 'listaObjetos'],
          additionalProperties: true
        }
      }
    },
    security: [{ ApiKey: [] }],
    paths: {
      '/api/clientes': { get: { tags: ['Clientes'], summary: 'Consulta cliente por CPF/CNPJ ou código externo', parameters: [
        { name: 'cpfCnpj', in: 'query', schema: { type: 'string', pattern: '^(?:\\d{11}|\\d{14})$' } },
        { name: 'codigoExterno', in: 'query', schema: { type: 'string' } }
      ], description: 'Informe exatamente um dos filtros.', responses: standardResponses('Cliente encontrado') } },
      '/api/clientes/por-nome': { get: { tags: ['Clientes'], summary: 'Consulta clientes por nome', parameters: [
        { name: 'nome', in: 'query', required: true, schema: { type: 'string', maxLength: 150 } },
        { name: 'porTrecho', in: 'query', schema: { type: 'boolean', default: true } }
      ], responses: standardResponses('Clientes encontrados') } },
      '/api/clientes/codigo/{codigoCRM}': { get: { tags: ['Clientes'], summary: 'Consulta cliente por código CRM', parameters: [
        { name: 'codigoCRM', in: 'path', required: true, schema: { type: 'string' } }
      ], responses: standardResponses('Cliente encontrado') } },
      '/api/clientes/{identificador}': { get: { tags: ['Clientes'], summary: 'Consulta cliente por identificador', parameters: [identifier], responses: standardResponses('Cliente encontrado') } },
      '/api/pedidos-venda': { get: { tags: ['Pedidos de venda'], summary: 'Lista pedidos de venda da empresa autorizada', description: `A empresa é fixada pelo servidor em ${c.PARTNER_COMPANY_CODE}.`, parameters: [
        { name: 'status', in: 'query', required: true, schema: { type: 'string', enum: ['A', 'L', 'P', 'T', 'X', 'C'] } },
        { name: 'cliente', in: 'query', schema: { type: 'string' } },
        { name: 'pedidoDeVenda', in: 'query', schema: { type: 'string' } },
        { name: 'pedidoDeCompraCliente', in: 'query', schema: { type: 'string' } },
        { name: 'emissaoInicial', in: 'query', schema: { type: 'string', format: 'date-time' } },
        { name: 'emissaoFinal', in: 'query', schema: { type: 'string', format: 'date-time' } },
        { name: 'limite', in: 'query', required: true, schema: { type: 'integer', minimum: 1, maximum: 100 } },
        { name: 'pagina', in: 'query', required: true, schema: { type: 'integer', minimum: 1 } }
      ], responses: standardResponses('Pedidos encontrados') } },
      '/api/pedidos-venda/{identificador}': { get: { tags: ['Pedidos de venda'], summary: 'Consulta pedido de venda da empresa autorizada', parameters: [identifier], responses: standardResponses('Pedido encontrado') } },
      '/api/produtos': { get: { tags: ['Produtos'], summary: 'Consulta produto enriquecido por código principal', parameters: [
        { name: 'codigo', in: 'query', required: true, schema: { type: 'string' } }
      ], responses: standardResponses('Produto com complementares e equivalentes') } },
      '/api/produtos/{identificador}': { get: { tags: ['Produtos'], summary: 'Consulta produto enriquecido por identificador', parameters: [identifier], responses: standardResponses('Produto com complementares e equivalentes') } },
      '/api/produtos/{identificador}/preco': { get: { tags: ['Preços'], summary: 'Consulta preço na empresa e tabela autorizadas', description: `Empresa ${c.PARTNER_COMPANY_CODE}; tabela ${c.PRICE_TABLE_CODE} (${c.PRICE_TABLE_ID}).`, parameters: [identifier], responses: standardResponses('Preço encontrado') } },
      '/api/produtos/{identificador}/estoques': { get: { tags: ['Estoque'], summary: 'Consulta estoque da empresa autorizada por setor', parameters: [
        identifier,
        { name: 'identificadorSetor', in: 'query', required: true, schema: { type: 'string', enum: c.STOCK_SECTOR_IDS.split(',') } }
      ], responses: standardResponses('Estoque encontrado') } },
      '/health/live': { get: { tags: ['Operação'], summary: 'Verifica se o processo está vivo', security: [], responses: { 200: { description: 'Processo ativo' } } } },
      '/health/ready': { get: { tags: ['Operação'], summary: 'Informa estado de inicialização', security: [], responses: { 200: { description: 'Estado atual' } } } },
      '/version': { get: { tags: ['Operação'], summary: 'Informa versão e revisão implantadas', security: [], responses: { 200: { description: 'Informações do build' } } } },
      '/status': { get: { tags: ['Operação'], summary: 'Informa checkpoint de sincronização', responses: { 200: { description: 'Estado da sincronização' }, 401: envelopeResponse('Não autorizado') } } },
      '/metrics': { get: { tags: ['Operação'], summary: 'Métricas Prometheus', responses: { 200: { description: 'Métricas em texto' }, 401: envelopeResponse('Não autorizado') } } }
    }
  };
}
