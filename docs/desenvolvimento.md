# Guia de desenvolvimento

Todo o fluxo de desenvolvimento, testes e verificação roda em Docker. Não é necessário instalar Node.js nem ferramentas de segurança no host.

## Estrutura de pastas

| Caminho | Função |
|---|---|
| `testflow-app/` | Backend (Node.js, Express, Mongoose; entrada em `index.js`, rotas em `server.js`). |
| `testflow-frontend/` | Frontend (React, Vite, Tailwind; versão exibida em `src/version.js`). |
| `nginx/` | Proxy reverso HTTPS/HTTP e configurações do Nginx. |
| `backup/` | Imagem do serviço pontual de backup criptografado com `age`. |
| `install/` | Script de inicialização do MongoDB (`mongo-init.js`). |
| `scripts/` | Automação local (`dev.sh`, `check.sh`, `restore.sh`, `build-inputs.sh`), git hooks (`scripts/git-hooks/`) e testes de repositório/infraestrutura (`scripts/test/`). |
| `docs/` | Documentação técnica do repositório (este guia e [build-inputs.md](build-inputs.md)). |
| `.github/workflows/` | Pipelines de CI e publicação (`develop.yml` e `release.yml`). |
| `docker-compose.yml` | Pilha base/produção (Nginx, frontend, backend, MongoDB e serviço de backup no perfil `tools`). |
| `docker-compose.dev.yml` | Sobreposição de desenvolvimento (recarga automática, portas locais `3000` e `5173`). |
| `docker-compose.teste.yml` | Serviços descartáveis para testes do backend (MongoDB e Mailpit sem portas no host). |
| `docker-compose.ci.yml` | Sobreposição usada no DAST para subir a pilha isolada em CI. |
| `VERSION` / `CHANGELOG.md` | Versão atual (SemVer) e histórico de mudanças por release. |

## Comandos do dia a dia

### Ambiente de desenvolvimento

```bash
sh scripts/dev.sh up      # cria .env (se faltar), ativa git hooks e sobe o projeto testflow-dev
sh scripts/dev.sh logs    # acompanha os logs dos serviços de desenvolvimento
sh scripts/dev.sh down    # derruba os contêineres de desenvolvimento
```

O `scripts/dev.sh` usa o projeto Compose `testflow-dev` (`docker-compose.yml` + `docker-compose.dev.yml`), isolado dos contêineres e volumes da produção. Ele expõe apenas a API em `http://localhost:3000` e o frontend em `http://localhost:5173/testflow/`. Defina `JWT_SECRET` (mínimo de 32 bytes, ex.: `openssl rand -hex 32`) no `.env` para o backend iniciar.

### Pilha de produção local e smoke das imagens

```bash
docker compose up -d --build          # compila e sobe a pilha de produção local (HTTPS/HTTP via Nginx)
docker compose logs <serviço>         # inspeciona logs de um serviço específico
docker compose down                   # encerra a pilha preservando os volumes de dados
sh scripts/test/images-smoke.sh       # smoke isolado: HTTPS, redirecionamento, login, upload e evidências
```

### Backup e restauração

```bash
docker compose --profile tools run --rm backup
scripts/restore.sh backups/testflow-<data>.tar.age --identity age-identity.txt \
  --network testflow_default --mongo-uri mongodb://mongodb-service:27017 \
  --db testflow-db-restaurado --evidence-dir ./evidencias-restauradas
```

### Git hooks

`scripts/dev.sh up` configura `git config core.hooksPath scripts/git-hooks`. Os hooks ativos são:

- `pre-commit`: bloqueia commit direto em `main`/`develop` e executa `scripts/check.sh secrets-staged`.
- `commit-msg`: valida o formato Conventional Commits (ex.: `feat(api): ...`, `fix: ...`, `docs: ...`).
- `pre-push`: impede operações proibidas nas branches protegidas e executa `scripts/check.sh quality` ao enviar para `develop`.

## Alvos do `scripts/check.sh`

Todas as verificações rodam em imagens fixadas por tag e digest em `scripts/check.sh`. Relatórios SARIF e de entradas de build são gravados em `reports/`.

| Alvo | O que executa |
|---|---|
| `quality` | Agregador obrigatório antes de integrar: `build-inputs`, `lint`, `test`, `test-scripts`, `test-repository` e `build`. |
| `all` | Agregador completo: `quality`, `integration`, `secrets`, `sast`, `sca` e `iac`. |
| `build-inputs` | Compara instalações limpas (`npm ci --engine-strict`, incluindo `--omit=dev` no backend) e grava hashes em `reports/build-inputs/`. Veja [build-inputs.md](build-inputs.md). |
| `lint` | Executa `npm ci --engine-strict && npm run lint` no backend e no frontend. |
| `test` | Executa `test-back` e `test-front` com limites mínimos de cobertura. |
| `test-back` | Sobe `docker-compose.teste.yml` num projeto isolado por worktree e roda `npm test` no backend. |
| `test-front` | Roda `npm test` no frontend (Vitest em `jsdom`). |
| `test-scripts` | Executa os testes em shell de `scripts/git-hooks/*.test.sh` e `scripts/*.test.sh` (exceto `backup.test.sh`). |
| `test-repository` | Executa `scripts/test/*.test.cjs` (higiene do repositório, contratos de versão/docs, Dockerfiles, Compose e workflows). |
| `build` | Executa `npm ci --engine-strict && npm run build` no frontend. |
| `integration` | Executa `scripts/backup.test.sh`: cria backup criptografado, restaura em banco novo descartável e compara os dados. |
| `secrets` | Varre todo o histórico Git com Gitleaks (`reports/gitleaks.sarif`). |
| `secrets-staged` | Varre apenas as alterações em stage com Gitleaks (usado pelo `pre-commit`). |
| `sast` | Executa Semgrep CE (`p/owasp-top-ten`, `p/nodejs`, `p/javascript`, `p/react`, `p/secrets`) em job único (`reports/semgrep.sarif`). |
| `sca` | Executa Trivy fs (`HIGH,CRITICAL`) nos lockfiles e `npm audit --audit-level=high` no backend e frontend. |
| `audit` | Executa `npm audit` em todas as severidades no backend e no frontend. |
| `iac` | Executa Hadolint em todos os Dockerfiles e Trivy config (`HIGH,CRITICAL`) nos arquivos de infraestrutura. |
| `build-prod` | Constrói do zero e verifica o conteúdo das três imagens de produção. |
| `scan-prod` | Lê `prod-images.tar`, aplica Trivy e gera os SBOMs em `reports/release-sbom/`. |
| `image-scan` | Compila o alvo `prod` do backend e executa Trivy image em todas as severidades. |
| `dast-full` | Sobe a pilha isolada via `scripts/ci-dast.sh` e executa varredura dinâmica OWASP ZAP. |

## Pipelines (`.github/workflows/`)

### `develop.yml`

- **Gatilhos:** `push` na branch `develop`, `workflow_dispatch` e `workflow_call` (com cancelamento de execuções obsoletas por ref).
- **Job `static`:** matriz paralela rodando `scripts/check.sh` para `quality`, `sast`, `sca`, `iac` e `audit`, publicando `reports/` como artefato.
- **Job `secrets`:** checkout completo (`fetch-depth: 0`) executando `scripts/check.sh secrets`.
- **Job `integration`:** após `static` e `secrets`, executa `scripts/check.sh integration`.
- **Job `dynamic`:** após `static` e `secrets`, executa `scripts/check.sh image-scan` e `scripts/check.sh dast-full`, publicando o relatório do ZAP.

### `release.yml`

- **Gatilhos:** push na `main` após o OK do dono, ou despacho manual com `dry_run: true` por padrão. Só a `main`, com publicação habilitada, altera GHCR, tags, Releases e produção. A primeira execução manual também exige o OK do dono.
- **Gates:** reutiliza todos os jobs de `develop.yml`, executa DAST completo e constrói do zero (`scripts/check.sh build-prod`), rejeitando testes, fixtures, ferramentas de desenvolvimento, source maps e segredos nas imagens.
- **Artefatos:** `scripts/check.sh scan-prod` aplica Trivy a backend, frontend e nginx em todas as severidades (inclusive sem correção) e gera um SBOM SPDX por imagem. As mesmas imagens aprovadas são publicadas, sem recompilar.
- **Publicação:** valida `VERSION` e as notas do `CHANGELOG.md`; recusa tag ou release existente e falha se não conseguir consultar o GitHub. Publica tags `vX.Y.Z`, SHA e `latest` no GHCR com `GHCR_PAT`, assina os digests com Cosign/OIDC e cria a tag e a GitHub Release com os SBOMs.
- **Produção:** após a Release, atualiza `testflow-prod` usando `PROD_REPO_TOKEN`, preservando configuração, documentação, backup e restauração. O Compose referencia a tag versionada aprovada.

## Versionamento

A versão oficial vive em `VERSION` (formato `X.Y.Z`) e permanece sincronizada com `testflow-app/package.json`, `testflow-frontend/package.json`, ambos os `package-lock.json` e `testflow-frontend/src/version.js` (contrato verificado em `scripts/check.sh test-repository`). Novas mudanças entram em `## [Unreleased]` no `CHANGELOG.md` e são promovidas para uma seção datada ao fechar cada release.
