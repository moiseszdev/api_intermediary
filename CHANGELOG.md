# Changelog

Todas as mudanças relevantes deste projeto são documentadas neste arquivo. O projeto segue Versionamento Semântico.

## [Unreleased]

### Documentação

- Tutorial Linux para gerar, conferir, aplicar e rotacionar a chave da API.
- Procedimento para confirmar versão, revisão Docker e conteúdo do Swagger implantado.

## [1.2.0] - 2026-11-25

### Adicionado

- Consultas de clientes por identificador, CPF/CNPJ, código externo, nome e código CRM.
- Consultas de pedidos de venda por identificador e status, restritas à empresa `1`.
- Consulta do preço de produto na empresa `1` e tabela `01` (`00A000001Q`).
- Swagger completo das consultas autorizadas e endpoint operacional `/version`.

## [1.1.0] - 2026-11-25

### Adicionado

- Deploy automatizado por runner Linux self-hosted após aprovação e merge na `main`.
- Consulta de estoque com empresa e setor controlados pelo servidor.
- Configuração da empresa `1`, setor comercial `00A0000008` e tabela de preço `01` (`00A000001Q`).

### Alterado

- Estoque restrito à empresa `1` e ao setor comercial explicitamente autorizado.
- Documentação de implantação Linux e operação com Docker Compose.

[Unreleased]: https://github.com/moiseszdev/api_intermediary/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/moiseszdev/api_intermediary/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/moiseszdev/api_intermediary/releases/tag/v1.1.0
