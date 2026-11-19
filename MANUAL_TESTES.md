# Manual rápido de testes

Este guia usa PowerShell e parte da pasta do projeto:

```powershell
Set-Location 'D:\OneDrive\Desktop\API_Integradoo'
```

## 1. Preparar a configuração

Crie o arquivo local de configuração:

```powershell
Copy-Item -LiteralPath '.env.example' -Destination '.env'
notepad .env
```

Preencha pelo menos:

```dotenv
BIMER_BASE_URL=https://ENDERECO-REAL-DO-BIMER
BIMER_USERNAME=USUARIO-DE-TESTE
BIMER_PASSWORD=SENHA-DE-TESTE
ERP_SQL_CONNECTION_STRING=Server=SERVIDOR;Database=BASE;User Id=USUARIO_SOMENTE_LEITURA;Password=SENHA;Encrypt=true;TrustServerCertificate=false
ERP_CODE_TYPE_ID=00A0000002
```

Não envie nem versione o `.env`. Ele já está ignorado pelo Git.

## 2. Criar a chave da API intermediária

Escolha uma chave forte para os testes:

```powershell
$apiTestKey = 'troque-por-uma-chave-longa-e-aleatoria'
$apiTestHash = node -e "console.log(require('crypto').createHash('sha256').update(process.argv[1]).digest('hex'))" $apiTestKey
$apiTestHash
```

Coloque o valor exibido no `.env`:

```dotenv
API_KEYS_SHA256=HASH_EXIBIDO_PELO_COMANDO
```

Guarde `$apiTestKey` na sessão do PowerShell: ele será enviado no header `x-api-key`. A API armazena somente seu hash.

## 3. Instalar e validar

```powershell
npm install
npm test
npm run typecheck
npm audit --omit=dev
```

Resultado esperado da suíte atual: `7` testes aprovados, checagem de tipos sem erros e nenhuma vulnerabilidade conhecida.

## 4. Iniciar a API

```powershell
node --env-file=.env .\node_modules\tsx\dist\cli.mjs src\server.ts
```

Resultado esperado:

```json
{"level":"info","message":"server_started","port":3000}
```

Mantenha esse terminal aberto. Use outro PowerShell para as chamadas abaixo. Se necessário, recrie a variável da chave:

```powershell
$apiTestKey = 'troque-por-uma-chave-longa-e-aleatoria'
```

## 5. Testar saúde e inicialização

```powershell
Invoke-RestMethod 'http://localhost:3000/health/live'
Invoke-RestMethod 'http://localhost:3000/health/ready'
```

`live` deve retornar `ok`. É esperado que `ready` retorne `pending-initialization` enquanto nenhum cursor inicial tiver sido configurado.

## 6. Consultar um produto pelo identificador

Troque o identificador por um produto existente na homologação:

```powershell
$headers = @{ 'x-api-key' = $apiTestKey }
$response = Invoke-RestMethod `
  -Uri 'http://localhost:3000/api/produtos/00A0000001' `
  -Headers $headers

$response | ConvertTo-Json -Depth 20
```

Confirme que:

- `erros` está vazio;
- os campos originais do produto continuam presentes;
- cada produto contém `produtosComplementares` e `produtosEquivalentes`;
- produtos sem relações retornam `[]`;
- `codigosChamada` é uma lista e preserva zeros à esquerda.

## 7. Consultar pelo código principal

```powershell
$response = Invoke-RestMethod `
  -Uri 'http://localhost:3000/api/produtos?codigo=00001' `
  -Headers $headers

$response | ConvertTo-Json -Depth 20
```

O valor de `codigo` é o código comercial, não o identificador interno de dez caracteres.

## 8. Testar autenticação da intermediária

Sem chave, a resposta deve ser HTTP `401`:

```powershell
try {
  Invoke-RestMethod 'http://localhost:3000/api/produtos/00A0000001'
} catch {
  $_.Exception.Response.StatusCode.value__
}
```

Repita com uma chave incorreta e confirme o mesmo resultado.

## 9. Status, métricas e Swagger

```powershell
Invoke-RestMethod -Uri 'http://localhost:3000/status' -Headers $headers
Invoke-WebRequest -Uri 'http://localhost:3000/metrics' -Headers $headers | Select-Object -ExpandProperty Content
Start-Process 'http://localhost:3000/docs'
```

## 10. Testar sincronização incremental

Não use cursor zero. Obtenha no ambiente um cursor seguro a partir do qual as mudanças devem ser acompanhadas e configure:

```dotenv
SYNC_INITIAL_CURSOR=CURSOR_VALIDADO
```

Antes de definir a opção abaixo, confirme com o fornecedor/homologação que `maiorVersaoRegistro` representa com segurança o máximo do lote retornado, inclusive quando existem mais registros que `SYNC_BATCH_SIZE` e quando há empates de versão:

```dotenv
SYNC_CURSOR_SEMANTICS_CONFIRMED=true
```

Reinicie a API e acione um ciclo manual:

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri 'http://localhost:3000/internal/sync' `
  -Headers $headers
```

Consulte o checkpoint:

```powershell
Invoke-RestMethod -Uri 'http://localhost:3000/status' -Headers $headers
```

Se a semântica ainda não estiver confirmada, o resultado seguro é:

```json
{"skipped":"cursor-semantics-not-confirmed"}
```

## 11. Cenários importantes em homologação

1. Cadastre e remova um complementar e confirme que a lista é substituída, não acumulada.
2. Repita com um equivalente.
3. Relacione um produto sem código do tipo `00A0000002` e confirme que ele permanece na lista com `codigosChamada: []`.
4. Altere apenas uma relação e verifique se a versão do produto principal muda.
5. Altere nome/código do produto relacionado e verifique quais produtos têm sua versão atualizada.
6. Simule indisponibilidade SQL: a API deve retornar erro, nunca listas vazias falsas.
7. Simule token expirado e confirme, nas métricas, uma única renovação.

Se os passos 4 e 5 não incrementarem a versão, será necessário validar Change Tracking ou CDC no SQL Server. A aplicação não habilita esses recursos automaticamente.

## Problemas comuns

- `401 Não autorizado`: o texto enviado em `x-api-key` não corresponde ao SHA-256 de `API_KEYS_SHA256`.
- erro de configuração ao iniciar: alguma variável obrigatória está vazia ou a URL não é válida.
- falha de certificado: instale/confie na cadeia correta; não desative validação em produção.
- erro SQL: confira conectividade, nome da base e permissão `SELECT` nas tabelas utilizadas.
- `pending-initialization`: configure um cursor inicial explicitamente; não use zero como fallback.
- `cursor-semantics-not-confirmed`: comportamento intencional até a paginação incremental ser validada.
