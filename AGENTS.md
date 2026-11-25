# TestFlow — instruções para agentes

<!-- Versionado e público: só regras. Nunca coloque aqui e-mail, nome, caminho da máquina, token,
     host interno ou dado real. CLAUDE.md e GEMINI.md só importam este arquivo. -->

## O que é

Sistema web para gerenciar projetos, demandas, cenários de teste e evidências. Stack MERN em Docker:
`testflow-app/` (Node, Express, Mongoose; entrada `index.js`, rotas em `server.js`),
`testflow-frontend/` (React, Vite, Tailwind), `nginx/` (HTTPS e proxy) e MongoDB.

## Cofre (contexto do projeto)

O cofre Obsidian fica fora do repositório, no link local `.testflow-docs/` (não versionado). Leia,
nesta ordem e nada além:

1. `.testflow-docs/00-indice.md` — mapa e estado atual.
2. `.testflow-docs/tarefas/00-fila.md` — fila de tarefas.
3. A nota da sua tarefa (`.testflow-docs/tarefas/<ID>.md`) e só as notas que ela linka.

`regras/`, `referencias/` e `decisions/`: busque o ID (`grep -n RN-41`), não leia o arquivo inteiro.
Nunca leia `99-arquivo/`. Não existe Documentador: quem fecha a tarefa atualiza o cofre. A nota da
tarefa recebe `status: feita` e até 5 linhas de decisões não óbvias. A nota de módulo só muda se
algo mudou que o próximo agente precisa saber. A linha da tarefa na fila do Maestri também é sua.
Nunca escreva lista de arquivos, diff, hashes, logs, diário ou ressalvas repetidas. Limites: nota de
tarefa até ~30 linhas, nota de módulo até ~60. O revisor trata nota faltando ou inchada como achado.

**O repositório é público.** Nada do cofre (auditoria, vulnerabilidades, regras internas) vai para
código, commits, issues, PRs ou releases. Mensagem de commit descreve a mudança, não a falha.

## Inegociáveis

- Tudo roda em Docker. `docker compose up -d --build` sobe a aplicação. Nada de instalar linguagem
  ou ferramenta no host: comandos de Node rodam em container.
- Segurança por padrão: OWASP ASVS nível 2 e OWASP Top 10.
- Toda mudança vem com testes, escritos por quem escreve o código. Regra de negócio usa TDD. Não há
  agente de QA: antes de entregar, `check.sh quality` mais os alvos que a mudança toca (seção
  Comandos). O pipeline da `develop` roda todos os gates a cada push.
- Cada Dev trabalha só na própria worktree (sandbox `workspace-write`). Merge na `develop` e push
  são do Orquestrador.
- Código limpo: funções pequenas, nomes claros, sem código morto, sem abstração prematura.
- Dependência nova só com justificativa.
- Segredo nunca no Git: `.env` ignorado, só `.env.example` com placeholders.

## Comandos

- Verificação por alvo: enquanto trabalha, o menor alvo que cobre a mudança (`test-back`,
  `test-front`, `build`). Antes de entregar, `scripts/check.sh quality` e só os alvos que a mudança
  toca: `integration` (backup ou arquivos), `e2e` (fluxo de tela), `iac` (Docker, compose, workflow),
  `sast` e `secrets` (autenticação, upload, configuração).
- `scripts/check.sh all` local só na release (`release-local`) ou para reproduzir pipeline vermelho.
- Revisão lê o código; roda no máximo um arquivo de teste para confirmar um achado, sem subir pilha.
- Merge: até 3 ou 4 tarefas revisadas por push; o pipeline da `develop` é a verificação completa.
  `check.sh quality` local só quando o merge tem conflito.
- Logs: `docker compose logs <serviço>`.

## Estrutura

- Nenhum arquivo Compose novo: só `docker-compose.yml` (produção, definição única dos serviços),
  `docker-compose.dev.yml` e `docker-compose.teste.yml` como camadas sobre a produção.
- Scripts de CI e release ficam em `scripts/ci/`.
- Testes de infraestrutura ficam em `scripts/test/` e validam apenas comportamento (nunca regex
  em texto de YAML, workflow ou Dockerfile; esses gates ficam em `check.sh`, Actionlint, Hadolint
  e Trivy).
- Arquivo novo na raiz do repositório só com ADR registrada no cofre.

## Git

- Branches: `main` (só versões oficiais), `develop` (funcionalidades prontas) e uma branch por
  tarefa a partir da `develop`:
  `feat/`, `fix/`, `chore/`, `docs/`, `ci/`, `refactor/`, `test/` + `<id>-<tema>`.
- Tarefa: branch → commits pequenos em Conventional Commits → `check.sh quality` e alvos verdes →
  revisão → `git merge --no-ff` na `develop` → push → apagar a branch local e remota → pipeline da
  `develop` verde. Pipeline vermelho: `fix/` antes de qualquer outra tarefa.
- Release: `check.sh release-local` → `chore/release-X.Y.Z` (`VERSION`, `CHANGELOG.md`) →
  relatório e sim explícito do dono → `git merge --no-ff develop` na `main` → push →
  `git switch develop && git merge --ff-only main && git push`.
- Nunca commit direto em `main` ou `develop`, nunca force push, nunca `--no-verify`.

## Autonomia e relatório da main

Neste repositório, trabalhe sem perguntar: pegue a próxima tarefa da fila, implemente, teste, faça
commit, merge na `develop`, push e siga. A única parada é a `main`: antes de qualquer merge nela,
mande ao dono este relatório (até 30 linhas) e espere um sim explícito. Silêncio, emoji ou resposta
ambígua não são sim. Enquanto espera, continue as tarefas na `develop`.

```
RELEASE vX.Y.Z — pronta para a main
Tarefas: <ID> — <título> (uma por linha)
Testes: release-local ✔ (quality, secrets, sast, sca, iac, image-scan, integration, e2e, dast-full, load)
Pipeline da develop: ✔ <link do run>
O que o usuário vai notar: …
Riscos e pendências: …
Posso versionar na main?
```

## Regras de segurança

- Senhas com bcrypt; nunca registrar senha, token ou e-mail em log.
- `JWT_SECRET` vem do ambiente, sem valor padrão; a aplicação não sobe sem ele.
- Toda rota de dados passa por `authMiddleware` e, quando restrita, `roleMiddleware`.
- Toda consulta filtra pelo que o usuário pode ver (teste de IDOR em cada rota nova).
- Entrada validada no servidor; resposta com projeção mínima (nunca o documento inteiro do usuário).
- Upload com limite de tamanho e tipo; arquivo de evidência só sai para quem tem acesso.
- `helmet` ligado; CORS só para a origem do front.

## Trabalhando neste repositório

- Pergunte ao dono só o que só ele resolve: credenciais, serviço pago, o sim da release, ou dúvida de
  produto que as regras e o código não respondem. O resto: decida, registre uma ADR no cofre
  (`decisions/`) e siga.
- Gates nunca são afrouxados: não pular, desligar ou apagar teste; não baixar cobertura nem
  severidade; nada de ignore genérico em Semgrep, ZAP, Trivy ou Gitleaks. Falso positivo só para uma
  regra específica, com a justificativa ao lado.
- Antes de cada commit, confira o que está em stage: nada de dado pessoal, caminho da máquina ou
  segredo.
- Docker: o host roda outros projetos. Mexa só em recursos `testflow`; nunca `prune` geral,
  `--privileged`, rede do host, nem `down -v` ou remoção dos volumes `mongo-data` e
  `evidencias_testes`.
- A mesma falha depois de 3 tentativas: pare a tarefa, marque bloqueada com o motivo e siga.
