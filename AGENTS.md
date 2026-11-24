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
Nunca leia `99-arquivo/`. Ao terminar a tarefa, atualize a nota dela: `status: feita` e a seção
"Resultado" em até 5 linhas. Notas curtas, sem hashes, logs, caminhos absolutos ou segredos.

**O repositório é público.** Nada do cofre (auditoria, vulnerabilidades, regras internas) vai para
código, commits, issues, PRs ou releases. Mensagem de commit descreve a mudança, não a falha.

## Inegociáveis

- Tudo roda em Docker. `docker compose up -d --build` sobe a aplicação. Nada de instalar linguagem
  ou ferramenta no host: comandos de Node rodam em container.
- Segurança por padrão: OWASP ASVS nível 2 e OWASP Top 10.
- Toda mudança vem com testes. Regra de negócio usa TDD.
- Código limpo: funções pequenas, nomes claros, sem código morto, sem abstração prematura.
- Dependência nova só com justificativa.
- Segredo nunca no Git: `.env` ignorado, só `.env.example` com placeholders.

## Comandos

- Verificação: `scripts/check.sh quality` (obrigatório antes de juntar) e `scripts/check.sh all`
  (recomendado). Enquanto a tarefa BASE-04 não existir, rode `npm ci && npm run lint` em
  `testflow-app/` e `testflow-frontend/`, e `npm run build` no front, num container `node:20`.
- Logs: `docker compose logs <serviço>`.

## Git

- Branches: `main` (só versões oficiais), `develop` (funcionalidades prontas; até a BASE-01 ela se
  chama `development`) e uma branch por tarefa a partir da `develop`:
  `feat/`, `fix/`, `chore/`, `docs/`, `ci/`, `refactor/`, `test/` + `<id>-<tema>`.
- Tarefa: branch → commits pequenos em Conventional Commits → `check.sh quality` verde →
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
