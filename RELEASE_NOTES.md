# Release Notes - TestFlow v1.0.0 (Production Ready)

**Data de Lançamento:** 29/01/2026
**Versão:** 1.0.0

🎉 **Temos o orgulho de apresentar a primeira versão oficial do TestFlow!**
Uma plataforma completa, robusta e containerizada para gestão de qualidade de software, projetada para centralizar testes, evidências e métricas.

---

## 🚀 Principais Funcionalidades

### 🔐 Autenticação e Segurança
*   **Sistema de Login Seguro**: Autenticação via JWT (JSON Web Tokens).
*   **Controle de Acesso Baseado em Cargos (RBAC)**:
    *   **Admin**: Acesso irrestrito a configurações de sistema (SMTP), gestão de usuários e todos os projetos.
    *   **QA/User**: Acesso focado em execução (Criar Projetos, Demandas, Cenários e Evidências), sem permissão para alterar configurações globais.
*   **Recuperação de Senha**: Fluxo completo de "Esqueci minha senha" com envio de token seguro via e-mail e redefinição com validação de força de senha.

### 📂 Gestão de Projetos
*   **CRUD Completo**: Criação, Edição, Visualização e Exclusão (com cascata de dados) de projetos.
*   **Deep Clone (Duplicação Inteligente)**: Funcionalidade poderosa para clonar um projeto inteiro (incluindo todas as demandas e cenários) para testes de regressão ou novas versões, mantendo a estrutura limpa (sem evidências antigas).

### 📋 Gestão de Demandas (Tickets)
*   **Fluxo de Status**: Pendente -> Em Andamento -> Testado.
*   **Integração Externa**: Campo dedicado para linkar cards do Jira/Trello/Azure DevOps.
*   **Sistema de Tags**: Etiquetas coloridas para categorização ágil (ex: "Bug", "Hotfix", "Release 1.0").
*   **Atribuição de Responsáveis**: Múltiplos QAs podem trabalhar na mesma demanda.

### 🧪 Cenários de Teste e Execução
*   **Editor de Cenários**: Interface para descrever o passo-a-passo (Gherkin-style ou texto livre).
*   **Validação Granular**: Associação direta de cenários às demandas.

### 📸 Sistema de Evidências (O Diferencial)
*   **Upload Múltiplo**: Suporte a drag-and-drop de múltiplas imagens simultaneamente.
*   **Armazenamento Organizado**: Arquivos salvos estruturadamente no servidor.
*   **Galeria Integrada**: Visualização de evidências (zoom, navegação) sem sair do contexto da demanda.
*   **Segurança de Arquivos**: Acesso restrito via autenticação.

### ⚙️ Configurações e Administração
*   **Configuração SMTP Dinâmica**: Interface administrativa para configurar servidores de email (Gmail, Outlook, Custom SMTP) sem precisar reiniciar o servidor.
*   **Gestão de Usuários**: O Admin pode convidar, editar e revogar acesso de usuários.
*   **Modo Escuro (Dark Mode)**: Suporte nativo a tema claro e escuro, persistente por usuário.

### 🐳 Infraestrutura e DevOps
*   **Dockerizado**: `docker-compose.yml` orquestrando Frontend (Nginx), Backend (Node.js) e volumes persistentes.
*   **Nginx Refinado**: Configuração otimizada para SPA (Single Page Application), lidando corretamente com rotas de client-side e Deep Linking.
*   **Hot-Fixes de Deploy**: Correção de problemas de rota base (`/testflow`) para garantir funcionamento em subdiretórios ou domínios raiz.

---

## 🛠️ Melhorias Técnicas e Correções (Changelog Completo)

### Frontend
- [NEW] Implementação do `DocumentationModal` com guia detalhado e responsivo.
- [NEW] Implementação do `AboutModal` com layout flexível e responsivo.
- [FIX] Correção do fluxo de `ResetPassword` para limpar a URL após sucesso.
- [FIX] Ajuste de responsividade nos Modais (Scroll interno, Cabeçalho fixo).
- [FIX] Implementação de `text-justify` em textos longos para melhor leitura.
- [UPDATE] Refinamento visual com TailwindCSS (sombras, bordas, transições).

### Backend
- [NEW] API Endpoints para `Projects/Clone`.
- [NEW] Serviço de Email (`emailService.js`) com suporte a configurações dinâmicas do BD.
- [FIX] Sanitização de URLs para evitar links quebrados em emails.
- [FIX] Proteção de rotas sensíveis (`/settings`) apenas para admins.

### Infraestrutura
- [FIX] `nginx.conf`: Regra `try_files` ajustada para `/testflow` e redirects de root.
- [FIX] Definição correta de `FRONTEND_URL` para geração de links.

---

**TestFlow v1.0.0** - *Qualidade não é um ato, é um hábito.*
