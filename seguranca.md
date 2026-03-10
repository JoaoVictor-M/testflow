# Relatório de Segurança do TestFlow

Este documento detalha as configurações, middlewares e práticas de segurança atualmente implementadas no projeto TestFlow, separadas por camada de aplicação, evidenciando o alinhamento com diretrizes e métodos de segurança internacionais consolidados, principalmente a **OWASP Top 10**.

---

## 1. Segurança de Infraestrutura e Redes (Nginx e Docker)

A borda da aplicação é protegida utilizando Nginx configurado com rigorosas políticas de criptografia:
- **Redirecionamento Obrigatório HTTPS:** Todo o tráfego HTTP na porta 80 é forçado via código 301 para a porta 443 (HTTPS). (Mitigação para interceptação de dados pasivos).
- **HSTS (HTTP Strict Transport Security):** Adicionado `Strict-Transport-Security "max-age=31536000; includeSubDomains" always;`. Impede ataques de *downgrade* de protocolo e força o navegador a lembrar de exigir HTTPS.
- **Desativação de Protocolos Inseguros:** Somente `TLSv1.2` e `TLSv1.3` são aceitos. Protocolos antigos e vulneráveis (SSLv3, TLSv1.0, TLSv1.1) estão desativados (Proteção contra vulnerabilidades como *POODLE* e *BEAST*).
- **Hardening de Ciphers:** Adotado `HIGH:!aNULL:!MD5` com preferência para ciphers do lado do servidor (`ssl_prefer_server_ciphers on`).

## 2. Segurança no Backend (Node.js/Express)

O servidor Backend atua primariamente mitigando os riscos listados no **OWASP Top 10**.

### 2.1. Proteção contra Injeção e Cross-Site Scripting (XSS)
- **Helmet.js (CSP e Headers HTTP):** A aplicação usa a biblioteca de segurança mais renomada em Node (`helmet`). 
  - Foi implementada uma política estrita de **Content Security Policy (CSP)**. O diretório padrāo bloqueia qualquer requisição (*defaultSrc: "'none'"*), aceitando conectividade de APIs preestabelecidas, evitando execução de scripts maliciosos injetados na tela. 
  - Cabeçalhos de rastreamento do backend (`x-powered-by`) são ocultados para dificultar reconhecimento da tecnologia ("fingerprinting").
- **Proteção Cross-Origin (CORS Restrito):** O CORS valida explicitamente as origens confiáveis (`FRONTEND_URL`), rejeitando solicitações de domínios maliciosos. (Mitigação do **OWASP A01:2021-Broken Access Control** e **A05:2021-Security Misconfiguration**).

### 2.2. Autenticação e Gestão de Sessão
- **Hashes Seguros com Bcrypt:** As senhas **nunca** são salvas em texto puro. É utilizado o algoritmo *Bcrypt* com "salt" automático gerado na própria base (`bcrypt.hash(this.password, salt)`), tornando os ataques por "Rainbow Tables" ineficazes (Atende ao **OWASP A02:2021-Cryptographic Failures** e **OWASP A07:2021-Identification and Authentication Failures**).
- **JSON Web Tokens (JWT):** A sessão utiliza JWT de viajem sem estado (stateless), com tokens assinados com segredos no nível do sistema operacional (variáveis `.env`).
- **Senhas Seguras:** A API força, inclusive com regex no frontend e backend, requisitos fortes: mínimo de 8 caracteres, números, caracteres especiais (@$!%*?&), maiúsculas e minúsculas. 

### 2.3. Controle de Acesso e Auditoria
- **Role-Based Access Control (RBAC):** Uso do `roleMiddleware(['admin', 'analyst'])` garantindo autorização horizontal e vertical. Usuários comuns não conseguem acessar rotas confidenciais (Atende ao **OWASP A01:2021-Broken Access Control**).
- **Logs de Auditoria (AuditLog):** Todas e quaisquer transações críticas (CREATE, UPDATE, DELETE em Projetos, Demandas e Usuários) são registradas no banco rastreando o `userId` de origem responsável, o dado "*novo*" gerado e o dado "*velho*". Isso é o alicerce para o **OWASP A09:2021-Security Logging and Monitoring Failures**. Se os dados são sensíveis, campos como senhas são deletados ativamente da cópia (`cleanAuditData`).

---

## 3. Segurança em CI/CD (DevSecOps)

O projeto incorpora uma esteira de **Integração e Entrega Contínuas (CI/CD)** via *GitHub Actions* (`security.yml`), garantindo que testes de segurança rodem automaticamente a cada *push* (mudança) na branch de desenvolvimento. 

A esteira de segurança (`Security Pipeline`) aborda quatro pilares essenciais:

### 3.1. SCA (Software Composition Analysis)
- **Dependency Scanning:** Utilizando validação nativa (`npm audit`) para o Backend e Frontend.
- **Objetivo:** O script varre o *package-lock.json* e o *node_modules* em busca de dependências ou bibliotecas de terceiros que possuam falhas conhecidas registradas em bancos de dados CVEs (Atende ao **OWASP A06:2021-Vulnerable and Outdated Components**).

### 3.2. SAST (Static Application Security Testing)
- **Inspeção de Código Estático:** Utilizando validação de análise de código puramente estática através de linter focado em segurança (`npm run lint` / ESLint Security Check).
- **Objetivo:** Encontrar vulnerabilidades (como variáveis inseguras ou funções de parse perigosas) diretamente no código-fonte construído pelos desenvolvedores *antes* mesmo de executar a aplicação.

### 3.3. Container Security Scan 
- **Trivy Scanner:** A imagem do Docker contendo o Backend final (`testflow-backend:latest`) é escaneada por uma ferramenta da *Aqua Security* (Trivy).
- **Objetivo:** Procurar vulnerabilidades de nível de SO (Sistema Operacional base) e de pacotes binários associados ao container. É configurado para **falhar criticamente (exit-code 1)** caso falhas severas (`HIGH`, `CRITICAL`) sejam detectadas, bloqueando o *deploy*.

### 3.4. DAST (Dynamic Application Security Testing)
- **OWASP ZAP (Zed Attack Proxy):** Uma implementação real em workflow dinâmico. O *pipeline* levanta instâncias efêmeras (com um banco de dados temporário e um backend vivo). 
- **Objetivo:** Escanear ativamente o projeto rodando através do `zap-full-scan.py`. O scanner tenta ataques reais de injeções (SQLi, XSS, Path Traversal) contra a aplicação levantada e exporta um relatório final `report_html.html` para as *Artifacts* da Action, independentemente da falha (permitindo estudo da brecha).

---

## 4. Diretrizes Seguidas

Todas essas abordagens consolidam-se fortemente com as seguintes diretrizes de segurança modernas da indústria de engenharia de software:

1. **Defense in Depth (Defesa em Profundidade):** Nenhuma camada confia cegamente na outra. O Frontend faz bloqueios, o Nginx bloqueia HTTP puro, o Middleware recusa acessos e o Banco de Dados oculta senhas mesmo se hackeado.
2. **Principle of Least Privilege (Princípio do Menor Privilégio):** Usuários de menor nível (ex: Visualizadores/"viewers") não possuem privilégios no sistema e sequer conseguem chamar as rotas de criação do Express graças aos middlewares.
3. **OWASP (Open Worldwide Application Security Project):** A implementação endereça ativamente XSS (via CSP), CORS/CSRF configurations, Criptografia Falha (com Bcrypt de salt embutido), Segurança nas Configurações do Nginx (HSTS/TLSv1.3) e Logger/Auditoria de rastreamento rigoroso.

## 5. Resumo Final
Os métodos aplicados (Helmet, TLS, RBAC, JWT, Bcrypt e AuditLogs estruturados), aliados a uma esteira vigorosa de testes automatizados **(SCA, SAST, DAST via ZAP e Trivy)**, representam o estado da arte e padrão ouro da indústria na arquitetura MERN (MongoDB, Express, React, Node.js) combinada com Docker. Tais práticas fecham as brechas sistêmicas contra a vasta maioria dos ataques modernos massivos, tanto em ambiente produtivo ao vivo quanto antes do deploy (shift-left security).
