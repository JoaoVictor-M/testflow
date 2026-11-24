# TestFlow — API

API do TestFlow, plataforma para gerenciar projetos, demandas, cenários de teste e evidências.
O repositório raiz tem o [README](../README.md) com instalação e operação; este arquivo cobre só o backend.

## Stack

- **Backend:** Node.js com Express e Mongoose
- **Banco de dados:** MongoDB
- **Frontend:** React com Vite e Tailwind (`../testflow-frontend`)
- **Proxy e HTTPS:** Nginx (`../nginx`)
- **Containerização:** Docker e Docker Compose

## Como rodar localmente

Tudo roda em Docker; não há Node nem MongoDB para instalar na máquina. Na raiz do repositório:

```bash
sh scripts/dev.sh up
```

O comando sobe MongoDB, API e front com recarga automática ao salvar. A API fica em
`http://localhost:3000` e o front em `http://localhost:5173/testflow/`; o MongoDB não é publicado.
Para parar, `sh scripts/dev.sh down`; para ver os logs, `sh scripts/dev.sh logs`.
Testes e verificações: `scripts/check.sh quality` (veja o [guia de desenvolvimento](../docs/desenvolvimento.md)).

## Autenticação

`POST /api/auth/login` devolve um token JWT, enviado depois no cabeçalho
`Authorization: Bearer <token>`. Os perfis são `admin`, `analyst` e `viewer`; as rotas que
criam, alteram ou excluem dados exigem `admin` ou `analyst`.

## Rotas

Os parâmetros e as respostas de cada rota estão em `server.js`.

| Grupo | O que cobre |
|---|---|
| `/health`, `/ready` | Saúde da API e do MongoDB, sem login. |
| `/api/auth` | Login, cadastro de usuário, recuperação e redefinição de senha. |
| `/api/users` | Listar, editar, excluir, importar usuários e gerar nome de usuário. |
| `/api/projects` | Listar, criar (ou duplicar com `sourceId`), editar e excluir projetos. |
| `/api/demandas` | Listar, criar, editar e excluir demandas; enviar, baixar e excluir evidências. |
| `/api/scenarios` | Listar, criar, editar e excluir cenários; `PATCH .../status` registra o resultado. |
| `/api/tags`, `/api/responsaveis`, `/api/versions`, `/api/servers` | Listas usadas nos formulários. |
| `/api/stats` | Números do painel. |
| `/api/config` | Servidor de e-mail (SMTP) e URLs permitidas para links de demandas; escrita só do `admin`. |
| `/api/audit` | Registro de criações, edições e exclusões; só o `admin`. |
| `/api/system` | Versão instalada. |

Este README descreve o que a versão atual entrega; planos futuros não fazem parte dele.
