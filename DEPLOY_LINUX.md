# Implantação no Linux com Docker

## Pré-requisitos

- Servidor Linux com Docker Engine e o plugin Docker Compose.
- Conectividade do servidor até a API Bimer e até o SQL Server na porta TCP 1433.
- DNS, rota e firewall liberados entre os servidores.

Não copie `node_modules`, `data` nem o `.env` do Windows. Transfira o restante do projeto para uma pasta como `/opt/bimer-api`.

## 1. Preparar o servidor

```bash
cd /opt/bimer-api
cp .env.example .env
chmod 600 .env
nano .env
```

Configuração mínima:

```dotenv
PORT=3000
BIMER_BASE_URL=https://servidor-bimer
BIMER_USERNAME=usuario
BIMER_PASSWORD=senha
ERP_SQL_CONNECTION_STRING=Server=192.168.1.165;Database=BASE;User Id=USUARIO;Password=SENHA;Encrypt=true;TrustServerCertificate=true
ERP_CODE_TYPE_ID=00A0000002
STOCK_COMPANY_CODES=1,4
API_KEYS_SHA256=HASH_SHA256_DA_CHAVE
STATE_DB_PATH=/app/data/integration.db
SYNC_INITIAL_CURSOR=
SYNC_CURSOR_SEMANTICS_CONFIRMED=false
```

Use `TrustServerCertificate=true` apenas enquanto o SQL Server utilizar certificado autoassinado. O ideal é instalar uma cadeia confiável e usar `false`.

## 2. Validar a rede

```bash
getent hosts servidor-bimer
timeout 5 bash -c '</dev/tcp/192.168.1.165/1433' && echo 'SQL acessível'
```

Se o Bimer ou SQL Server estiverem em outra rede, corrija rota, VPN e firewall antes de iniciar.

## 3. Construir e iniciar

```bash
docker compose build --pull
docker compose up -d
docker compose ps
docker compose logs -f --tail=100
```

O estado SQLite fica no volume Docker `bimer-state` e sobrevive à recriação do container.

## 4. Testar

```bash
curl -fsS http://127.0.0.1:3000/health/live
```

```bash
API_KEY='CHAVE_ORIGINAL'

curl -fsS \
  -H "x-api-key: $API_KEY" \
  http://127.0.0.1:3000/api/produtos/00A00080BZ | jq
```

```bash
curl -fsS \
  -H "x-api-key: $API_KEY" \
  http://127.0.0.1:3000/api/produtos/00A00080BZ/estoques | jq
```

O estoque deve conter apenas `codigoEmpresa` 1 e 4.

## 5. Operação

```bash
docker compose logs -f --tail=200
docker compose restart
docker compose down
docker compose up -d --build
```

Para backup do SQLite, pare brevemente o serviço e copie o volume, ou use uma ferramenta de backup compatível com SQLite/WAL. Não apague o volume `bimer-state`.

O comando abaixo remove containers e também o volume persistente; não o utilize em operação normal:

```bash
docker compose down -v
```

## 6. Exposição segura

Mantenha a porta 3000 restrita à rede interna ou ao proxy reverso. Para acesso externo, publique HTTPS em Nginx, Caddy, Traefik ou balanceador e encaminhe para `127.0.0.1:3000`. Não exponha o SQL Server à internet.

Exemplo Nginx:

```nginx
server {
    listen 443 ssl;
    server_name api.exemplo.com;

    ssl_certificate /etc/letsencrypt/live/api.exemplo.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.exemplo.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Correlation-Id $request_id;
    }
}
```

Se o acesso for somente interno, limite a porta no firewall ao IP ou à sub-rede consumidora.

## 7. Atualização

Transfira os arquivos novos e execute:

```bash
cd /opt/bimer-api
docker compose build --pull
docker compose up -d
docker compose ps
docker compose logs --tail=100
```

Não habilite `SYNC_CURSOR_SEMANTICS_CONFIRMED=true` até a paginação incremental ser validada. As consultas individuais e o estoque funcionam com a sincronização desativada.

## 8. Deploy automático pelo GitHub Actions

Use no servidor um usuário de deploy que seja dono da pasta do projeto e tenha permissão para executar Docker. Não use `root` no workflow.

No servidor, gere uma chave dedicada para ele conseguir atualizar um repositório privado, se necessário:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/github_repository -C bimer-api-deploy
cat ~/.ssh/github_repository.pub
```

Cadastre a chave pública como **Deploy key**, somente leitura, em **GitHub > Settings > Deploy keys**. Depois configure o clone para usar SSH:

```bash
cd /opt/bimer-api
git remote set-url origin git@github.com:moiseszdev/api_intermediary.git
git config core.sshCommand 'ssh -i ~/.ssh/github_repository -o IdentitiesOnly=yes'
git pull --ff-only origin main
```

Para o caminho inverso, GitHub Actions acessando o servidor, gere outra chave em uma máquina administrativa:

```bash
ssh-keygen -t ed25519 -f bimer_api_actions -C github-actions-bimer-api
```

Adicione o conteúdo de `bimer_api_actions.pub` ao `~/.ssh/authorized_keys` do usuário de deploy no servidor. Guarde a chave privada como secret do GitHub e não a copie para o projeto.

Crie o environment **production** em **GitHub > Settings > Environments** e cadastre estes secrets:

- `DEPLOY_HOST`: IP ou nome DNS do servidor.
- `DEPLOY_PORT`: porta SSH, normalmente `22`.
- `DEPLOY_USER`: usuário Linux de deploy.
- `DEPLOY_PATH`: pasta do clone, por exemplo `/opt/bimer-api`.
- `DEPLOY_SSH_KEY`: conteúdo completo da chave privada `bimer_api_actions`.
- `DEPLOY_KNOWN_HOSTS`: saída validada de `ssh-keyscan -H servidor`.

Antes do primeiro deploy automático, valide no servidor:

```bash
cd /opt/bimer-api
test -f .env
git pull --ff-only origin main
docker compose config --quiet
docker compose build --pull
docker compose up -d
curl -fsS http://127.0.0.1:3000/health/live
```

Depois disso, cada push na branch `main` faz testes, valida o build Docker e, se tudo passar, atualiza produção. O arquivo `.env` e o volume `bimer-state` não são substituídos pelo deploy.
