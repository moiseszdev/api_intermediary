# Contrato de leitura do parceiro

Versão planejada: `1.2.0`.

Todas as rotas de negócio exigem `x-api-key`. A API intermediária expõe somente consultas explicitamente autorizadas e nunca encaminha caminhos arbitrários ao Bimer.

## Escopo fixo

- Empresa: `1`.
- Tabela de preço: código `01`, identificador `00A000001Q`.
- Setor de estoque: `00A0000008` (Setor Comercial Almoxarife).
- Pedidos: somente consulta de pedidos de venda da empresa `1`.
- Clientes: consultas de pessoas disponibilizadas pelo contrato oficial.

## Rotas públicas

### Clientes

- `GET /api/clientes/{identificador}`
- `GET /api/clientes?cpfCnpj={cpfCnpj}`
- `GET /api/clientes?codigoExterno={codigoExterno}`
- `GET /api/clientes/por-nome?nome={nome}&porTrecho={boolean}`
- `GET /api/clientes/codigo/{codigoCRM}`

### Pedidos de venda

- `GET /api/pedidos-venda/{identificador}`
- `GET /api/pedidos-venda?status={status}&limite={limite}&pagina={pagina}`

A listagem aceita ainda `cliente`, `pedidoDeVenda`, `pedidoDeCompraCliente`, `emissaoInicial` e `emissaoFinal`. A empresa é sempre inserida pelo servidor.

### Produtos, preço e estoque

- `GET /api/produtos/{identificador}`
- `GET /api/produtos?codigo={codigo}`
- `GET /api/produtos/{identificador}/preco`
- `GET /api/produtos/{identificador}/estoques?identificadorSetor=00A0000008`

## Fora de escopo

- Criação, alteração, baixa ou exclusão de clientes, pedidos e produtos.
- Cálculo de impostos.
- Consulta de outras empresas, tabelas de preço ou setores.
- Proxy genérico para rotas do Bimer.
