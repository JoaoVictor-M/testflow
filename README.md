# TestFlow - Quality Management

O **TestFlow** é uma plataforma completa e containerizada para gerenciamento de testes de software, controle de evidências e métricas de qualidade.

[![License: AGPL v3 + Commons Clause](https://img.shields.io/badge/License-AGPL_v3_%2B_Commons_Clause-blue.svg)](LICENSE)

---

## 🚀 Funcionalidades
*   **Gestão de Projetos e Demandas**: Controle total do ciclo de vida, agrupando funcionalidades em níveis lógicos e organizados.
*   **Evidências Inteligentes**: Upload múltiplo simultâneo, visualização em galeria integrada e separação sistêmica entre testes.
*   **Deep Clone**: Duplicação imediata e profunda de projetos para cenários de teste de regressão versão-a-versão.
*   **Segurança e RBAC**: Autenticação restrita JWT. Diferenciação lógica estrita entre Administradores (Gestor Total) e Analistas (Executores operacionais). *Admins só podem ser criados por admins.*
*   **Auditoria Transparente**: Painel silencioso interativo para administradores rastrearem quem criou, apagou ou editou cada campo do software em tempo real (Comparação de Diff).
*   **Infraestrutura Otimizada**: Reversa por Nginx estritamente tipado e MongoDB persistindo relatórios locais e artefatos de mídia.

Consulte o histórico de versões em [CHANGELOG.md](https://github.com/JoaoVictor-M/testflow/blob/main/CHANGELOG.md).

---

## 📦 Instalação do Deploy para Produção

Suba o sistema em produção em poucas linhas:
```bash
git clone https://github.com/JoaoVictor-M/testflow-prod.git testflow && cd testflow
cp .env.example .env   # defina JWT_SECRET, FRONTEND_URL e TESTFLOW_ADMIN_PASSWORD_HASH
docker compose up -d
```

A partir desse momento, as imagens mais recentes do Github Container Registry (`ghcr.io`) serão orquestradas para rodarem via porta `80` (HTTP web).

As três imagens da aplicação executam sem root. Antes de iniciar o backend (UID/GID 1000), o
Compose executa um serviço pontual que ajusta a propriedade do bind `evidencias_testes`. Ele não
apaga arquivos nem troca volumes, funciona também em atualizações e não precisa de script externo.
Somente esse serviço de preparação executa como root, sem rede e com acesso de escrita ao bind.

Para HTTPS, coloque o certificado `.crt` e a chave `.key` em `certificados/`. O nginx usa UID/GID
101 e precisa ler ambos. Ao atualizar uma instalação com chave `root:root` e modo `0600`, ajuste
o grupo e a leitura antes de subir o serviço (o nginx informa um erro explícito se não puder ler):

```bash
sudo chgrp 101 certificados certificados/*.crt certificados/*.key
sudo chmod 750 certificados
sudo chmod 640 certificados/*.crt certificados/*.key
```

Configure `.env` a partir de `.env.example`: `FRONTEND_URL=https://testflow.example.com/testflow`
permite derivar automaticamente a origem `https://testflow.example.com`. Para várias URLs ou uma
URL HTTP no front, defina explicitamente `NGINX_PUBLIC_ORIGIN=https://testflow.example.com`.
A origem explícita tem prioridade e aceita somente hostname válido e porta entre 1 e 65535,
sem caminho ou barra final. Sem ambas as configurações, o padrão local é `https://localhost`.
O redirecionamento preserva o caminho e usa essa origem confiável; o proxy envia o host do upstream.
As portas públicas continuam 80/443 (internas 8080/8443). Sem certificados, há fallback HTTP.

### Primeiro administrador

O banco nasce sem usuários: o `admin` só é criado na primeira subida de um volume `mongo-data` novo,
e só a partir de um hash bcrypt (custo 10 ou mais) que você fornece. Antes do primeiro `docker compose up`:

1. Gere o hash da senha escolhida, sem deixá-la no histórico do shell:
   ```bash
   read -rs SENHA && printf '%s' "$SENHA" | docker compose run --rm --no-deps -T backend-service \
     node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(require('bcryptjs').hashSync(s,10)))"
   ```
2. Grave a saída no `.env`, entre aspas simples por causa dos `$`:
   `TESTFLOW_ADMIN_PASSWORD_HASH='$2b$10$...'`
3. Suba o sistema. O log do MongoDB (`docker compose logs mongodb-service`) diz se o admin foi criado,
   se a variável faltou ou se o hash é inválido.

Instalações que já têm dados não mudam: o seed não roda de novo.

### Chave JWT, migração e rotação

O backend exige `JWT_SECRET` no `.env` (ou no ambiente do container) com pelo menos 32 bytes. Sem uma chave válida, o serviço não inicia e registra o erro de configuração sem expor valores. Gere uma chave forte antes de subir:

```bash
openssl rand -hex 32
```

Grave o resultado no `.env` como `JWT_SECRET=<chave-gerada>`.

- **Migração de instalações existentes:** se o `.env` anterior não definia `JWT_SECRET`, defina uma chave nova antes de subir a versão atualizada.
- **Rotação da chave:** para rotacionar `JWT_SECRET`, atualize o valor no `.env` e reinicie a aplicação (`docker compose up -d`).
- **Efeito em sessões existentes:** ao migrar ou rotacionar `JWT_SECRET`, todos os tokens emitidos com a chave anterior deixam de ser aceitos imediatamente; usuários conectados precisarão fazer login novamente. Nenhum dado do banco ou de evidências é afetado.

---

## 🔄 Como Atualizar o Sistema

Quando uma nova versão estiver disponível, verifique se `JWT_SECRET` já está definido no `.env` (veja **Chave JWT, migração e rotação** acima) e execute os comandos abaixo dentro da pasta do projeto:
```bash
docker compose down
docker rmi ghcr.io/joaovictor-m/testflow-backend:latest ghcr.io/joaovictor-m/testflow-frontend:latest ghcr.io/joaovictor-m/testflow-nginx:latest 2>/dev/null
docker compose up -d
```

Isso garante que as imagens antigas sejam removidas e as novas sejam baixadas do registro. Seus dados (banco e evidências) serão preservados.

---

## 💾 Backup e Restauração

O backup junta o banco e as evidências num único arquivo criptografado com [age](https://github.com/FiloSottile/age). O servidor guarda só a chave **pública**; a chave privada fica fora dele e do Git.

1. Em outra máquina, gere o par: `age-keygen -o age-identity.txt`. Guarde `age-identity.txt` em local seguro.
2. No `.env`, defina `BACKUP_AGE_RECIPIENT` com a chave pública (a linha `age1...` do arquivo gerado).
3. Crie a pasta de destino (`mkdir backups`; o UID 1000 precisa poder gravar nela, e o arquivo sai com modo 0600 desse UID) e rode `docker compose --profile tools run --rm backup`. O arquivo `backups/testflow-<data>.tar.age` aparece ao final. `BACKUP_DIR` muda a pasta de destino.

A restauração nunca sobrescreve os dados em uso: ela cria um banco novo e preenche uma pasta vazia.
```bash
scripts/restore.sh backups/testflow-<data>.tar.age --identity age-identity.txt --network testflow_default \
  --mongo-uri mongodb://mongodb-service:27017 --db testflow-db-restaurado --evidence-dir ./evidencias-restauradas
```

---

## 🗑️ Como Desinstalar / Zerar o Sistema

Caso precise limpar completamente o banco de dados do TestFlow (voltar ao estado zero, formato de fábrica) ou excluí-lo por completo de sua máquina/servidor, o procedimento é extremamente simples por conta de sua natureza *containerizada*. Os comandos abaixo **removem apenas os recursos do TestFlow**, sem afetar outros containers ou projetos no mesmo servidor.

**Para apenas derrubar a aplicação (mantendo os dados salvos):**
```bash
docker compose down
```

**Para desinstalar completamente (Atenção: Ação Irreversível):**
Remove containers, volumes (banco de dados), imagens baixadas e a pasta do projeto.

*No Linux/Mac:*
```bash
docker compose down -v --rmi all && cd .. && rm -rf testflow
```
*No Windows (PowerShell):*
```powershell
docker compose down -v --rmi all ; cd .. ; Remove-Item -Recurse -Force testflow
```

---

## 🛠️ Desenvolvimento (Para Code Maintainers)

Suba o ambiente local em Docker (recarga automática; API em `http://localhost:3000`, front em `http://localhost:5173/testflow/`):

```bash
git clone git@github.com:JoaoVictor-M/testflow.git && cd testflow
sh scripts/dev.sh up
```

O `scripts/dev.sh` usa um projeto Compose isolado (`testflow-dev`), prepara `.env` e ativa os git hooks. Antes de enviar alterações, rode `scripts/check.sh quality` (ou `scripts/check.sh all` para mudanças em segurança, dados ou infraestrutura).

Consulte o [guia de desenvolvimento](docs/desenvolvimento.md) (pastas, comandos, alvos do `check.sh` e pipelines) e a [política de entradas de build](docs/build-inputs.md).

---

## 📜 Licença e Termos de Uso (Open Source)

O TestFlow é distribuído organicamente sob a licença **GNU AGPLv3** acrescida da **Commons Clause**. 

*   **O que você pode fazer:** Baixar, instalar em sua infraestrutura, modificar, fazer *fork* e utilizar gratuitamente para uso corporativo, equipe de QA pessoal ou fins educacionais.
*   **O que você NÃO pode fazer:** Vender o TestFlow (original ou suas modificações) e oferecê-lo como software provido como serviço pago (SaaS / Cloud Hosting comercial) a terceiros.
*   **Obrigatório:** Qualquer uso, modificação ou redistribuição deve manter os créditos ao desenvolvedor original **João Victor Melo**. A atribuição deve ser preservada em todas as cópias, versões modificadas e trabalhos derivados.
