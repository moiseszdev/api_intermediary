# API intermediária Bimer

API Node.js/TypeScript que preserva o envelope e todos os campos retornados pelo Bimer e acrescenta `produtosComplementares` e `produtosEquivalentes` em cada item. A escolha por Node.js foi feita porque o repositório estava vazio e o ambiente não possui o SDK .NET; o runtime disponível é Node 24, com `node:sqlite` nativo para o estado próprio.

## Executar

1. Copie `.env.example` para `.env` e preencha os valores. O processo não lê `.env` sozinho: injete-o pelo gerenciador de serviços/segredos ou execute `node --env-file=.env ./node_modules/tsx/dist/cli.mjs src/server.ts`.
2. Gere uma chave de consumidor e configure somente o SHA-256 hexadecimal em `API_KEYS_SHA256` (`node -e "console.log(require('crypto').createHash('sha256').update('SUA_CHAVE').digest('hex'))"`).
3. Execute `npm install`, `npm test`, `npm run typecheck` e `npm start`.
4. Swagger da intermediária: `http://localhost:3000/docs`.

Contrato de leitura do parceiro: `docs/API_PARCEIRO.md`. A versão efetivamente implantada pode ser consultada em `GET /version`.

Exemplo:

```http
GET /api/produtos/00A0000001 HTTP/1.1
Host: localhost:3000
x-api-key: SUA_CHAVE
```

Estoque é consultado separadamente, somente na empresa `1` e no setor autorizado `00A0000008`. A tabela de preço confirmada é código `01`, identificador `00A000001Q`:

```http
GET /api/produtos/00A0000001/estoques?identificadorSetor=00A0000008 HTTP/1.1
x-api-key: SUA_CHAVE
```

```json
{
  "erros": [],
  "listaObjetos": [{
    "identificador": "00A0000001",
    "codigo": "00001",
    "nome": "Produto",
    "produtosComplementares": [{ "identificador": "00A0000002", "codigosChamada": ["00002"], "nome": "Complementar" }],
    "produtosEquivalentes": []
  }]
}
```

## Sincronização e cache

O SQLite próprio guarda envelopes, checkpoint e última sincronização. Um lote só é publicado e o cursor só avança na mesma transação após todos os detalhes e relações terem sido obtidos. Upsert torna o reprocessamento idempotente. Sem `SYNC_INITIAL_CURSOR`, o estado fica `pending-initialization`; cursor zero jamais é assumido. Consultas individuais vão diretamente à origem e funcionam sem uma carga histórica.

O worker está deliberadamente bloqueado até `SYNC_CURSOR_SEMANTICS_CONFIRMED=true`. O Swagger informa filtro estritamente maior e `maiorVersaoRegistro`, mas não garante se esse máximo pertence ao lote limitado, como empates são tratados, nem como evitar saltos sem parâmetro de página. Só confirme após homologação. Começar em uma versão recente não recupera produtos anteriores.

Política: consultas HTTP são sob demanda; o cache é atualizado pelo fluxo incremental, mas não é usado como fallback silencioso quando Bimer/SQL falham. `/status` informa checkpoint; `/health/live`, vida do processo; `/health/ready`, inicialização. `/metrics` e `/status` exigem chave.

## Segurança e operação

- Use HTTPS no proxy reverso e `Encrypt=true;TrustServerCertificate=false` no SQL Server.
- O usuário SQL deve ter apenas `SELECT` nas cinco tabelas consultadas. Credenciais Bimer nunca são retornadas ou logadas.
- Restrinja `ALLOWED_ORIGINS`; autenticação da intermediária é independente do Bimer. A conta Bimer usada deve ter o menor escopo possível. Esta versão usa uma conta/escopo; multiempresa exige mapeamento explícito de consumidor para credencial antes de operar.
- Para múltiplas réplicas, execute o worker em apenas uma instância. O lock atual é de processo; coordenação distribuída não foi implementada.
- Migração documentada em `migrations/001_initial.sql`; a aplicação também a aplica de forma idempotente.

## Validações ainda necessárias em homologação

1. Unidade real de `expiresIn` (configurável como `seconds` ou `milliseconds`).
2. Semântica de `maiorVersaoRegistro`, limites, empates e mudanças concorrentes.
3. Se alterações em relações, nome ou códigos incrementam a versão do produto.
4. Disponibilidade/retenção de SQL Server Change Tracking ou CDC. Nada é habilitado automaticamente; sem um desses mecanismos, remoções e mudanças apenas nas relações não são detectáveis incrementalmente com garantia.
5. Escopo por empresa/usuário e certificados do ambiente.

Não foi executado teste contra Bimer ou SQL Server real. Os testes usam doubles da origem.
