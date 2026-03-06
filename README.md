# TestFlow - Quality Management

O **TestFlow** é uma plataforma completa e containerizada para gerenciamento de testes de software, controle de evidências e métricas de qualidade.

[![License: AGPL v3 + Commons Clause](https://img.shields.io/badge/License-AGPL_v3_%2B_Commons_Clause-blue.svg)](LICENSE)

---

## 🚀 Funcionalidades da Versão 1.0.0
*   **Gestão de Projetos e Demandas**: Controle total do ciclo de vida, agrupando funcionalidades em níveis lógicos e organizados.
*   **Evidências Inteligentes**: Upload múltiplo simultâneo, visualização em galeria integrada e separação sistêmica entre testes.
*   **Deep Clone**: Duplicação imediata e profunda de projetos para cenários de teste de regressão versão-a-versão.
*   **Segurança e RBAC**: Autenticação restrita JWT. Diferenciação lógica estrita entre Administradores (Gestor Total) e Analistas (Executores operacionais). *Admins só podem ser criados por admins.*
*   **Auditoria Transparente**: Painel silencioso interativo para administradores rastrearem quem criou, apagou ou editou cada campo do software em tempo real (Comparação de Diff).
*   **Infraestrutura Otimizada**: Reversa por Nginx estritamente tipado e MongoDB persistindo relatórios locais e artefatos de mídia.

---

## 📦 Instalação do Deploy para Produção

Execute o comando abaixo no terminal do seu servidor ou nuvem para baixar os arquivos necessários e subir o sistema:
   ```bash
   git clone https://github.com/JoaoVictor-M/testflow-prod.git testflow && cd testflow && docker compose up -d
   ```

A partir desse momento, as imagens mais recentes do Github Container Registry (`ghcr.io`) serão orquestradas para rodarem via porta `80` (HTTP web).

---

## 🔄 Como Atualizar o Sistema

Quando uma nova versão estiver disponível, execute os comandos abaixo dentro da pasta do projeto:
```bash
docker compose down
docker rmi ghcr.io/joaovictor-m/testflow-backend:latest ghcr.io/joaovictor-m/testflow-frontend:latest ghcr.io/joaovictor-m/testflow-nginx:latest 2>/dev/null
docker compose up -d
```

Isso garante que as imagens antigas sejam removidas e as novas sejam baixadas do registro. Seus dados (banco e evidências) serão preservados.

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

Se você tem acesso a este código-fonte (origin/development) e deseja contribuir ou iterar nas rotas locais:

1.  Clone este repositório matricial:
    ```bash
    git clone git@github.com:JoaoVictor-M/testflow.git
    ```
2.  Inicie forçando a compilação local das camadas lógicas NodeJS e Vite:
    ```bash
    docker compose up -d --build
    ```

---

## 📜 Licença e Termos de Uso (Open Source)

O TestFlow é distribuído organicamente sob a licença **GNU AGPLv3** acrescida da **Commons Clause**. 

*   **O que você pode fazer:** Baixar, instalar em sua infraestrutura, modificar, fazer *fork* e utilizar gratuitamente para uso corporativo, equipe de QA pessoal ou fins educacionais.
*   **O que você NÃO pode fazer:** Vender o TestFlow (original ou suas modificações) e oferecê-lo como software provido como serviço pago (SaaS / Cloud Hosting comercial) a terceiros.
