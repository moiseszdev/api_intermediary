# Changelog

Todas as mudanças relevantes deste projeto são documentadas neste arquivo. O projeto segue Versionamento Semântico.

## [Unreleased]

## [1.1.0] - 2026-11-25

### Adicionado

- Deploy automatizado por runner Linux self-hosted após aprovação e merge na `main`.
- Consulta de estoque com empresa e setor controlados pelo servidor.
- Configuração da empresa `1`, setor comercial `00A0000008` e tabela de preço `01` (`00A000001Q`).

### Alterado

- Estoque restrito à empresa `1` e ao setor comercial explicitamente autorizado.
- Documentação de implantação Linux e operação com Docker Compose.

[Unreleased]: https://github.com/moiseszdev/api_intermediary/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/moiseszdev/api_intermediary/releases/tag/v1.1.0
