# Changelog

Todas as mudanças relevantes deste projeto são documentadas neste arquivo.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e este projeto adota [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Unreleased]

### Adicionado
- Pipeline de release na `main`, com build limpo, Trivy, SBOMs, imagens assinadas no GHCR e recusa de versões já publicadas.
- Arquivo `VERSION`, `CHANGELOG.md` e guia de desenvolvimento em `docs/desenvolvimento.md`.
- Script único `scripts/check.sh` com verificações de qualidade, testes, entradas de build, segredos, SAST, SCA, IaC, imagem e integração em contêineres fixados por digest.
- Ambiente de desenvolvimento containerizado (`docker-compose.dev.yml` e `scripts/dev.sh`) isolado da pilha de produção, com recarga automática e ativação dos git hooks.
- Git hooks em `scripts/git-hooks/` para Conventional Commits, varredura de segredos no stage e proteção das branches `main` e `develop`.
- Suíte de testes automatizados no backend (com MongoDB e Mailpit descartáveis em `docker-compose.teste.yml`), no frontend (Vitest/jsdom) e nos contratos do repositório.
- Endpoints de saúde (`/health` e `/ready`), healthchecks nas imagens e logs estruturados em JSON.
- Backup criptografado com `age` (`backup/` e perfil `tools` no Compose), script de restauração (`scripts/restore.sh`) e teste automatizado de backup/restauração.
- Pipeline unificado da branch `develop` (`.github/workflows/develop.yml`) com verificações estáticas, de segredos, de integração e dinâmicas.
- Documentação de entradas reproduzíveis de build em `docs/build-inputs.md`.

### Alterado
- Imagens Docker de backend, frontend e Nginx refatoradas com estágios `dev`/`prod`, execução sem root e digests fixados.
- Inicialização de administrador via hash bcrypt fornecido por ambiente (`TESTFLOW_ADMIN_PASSWORD_HASH`), sem credenciais padrão no repositório.
- Configuração de origem pública do Nginx (`NGINX_PUBLIC_ORIGIN` / `FRONTEND_URL`) e preparação automática de permissões de evidências no Compose.

## [1.0.1] - 2026-03-30

### Alterado
- Atualização de dependências de backend e frontend para manter a árvore livre de vulnerabilidades conhecidas.
- Ajustes de configuração no pipeline de CI e limpeza de avisos do ESLint.

### Corrigido
- Endurecimento de segurança da aplicação (remediações de pentest).
- Atualização da versão exibida na interface para `v1.0.1`.

## [1.0.0] - 2026-03-18

### Adicionado
- Gestão de projetos, demandas, cenários de teste e upload múltiplo de evidências com galeria.
- Duplicação profunda (*deep clone*) de projetos para ciclos de regressão.
- Autenticação JWT com controle de acesso por perfil (Administrador e Analista).
- Trilha de auditoria com visualização de alterações para administradores.
- Infraestrutura containerizada com backend Express/Mongoose, frontend React/Vite/Tailwind, Nginx e MongoDB.

[Unreleased]: https://github.com/JoaoVictor-M/testflow/compare/v1.0.1...develop
[1.0.1]: https://github.com/JoaoVictor-M/testflow/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/JoaoVictor-M/testflow/releases/tag/v1.0.0
