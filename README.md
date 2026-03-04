# TestFlow - Gestão de Qualidade e Testes

O **TestFlow** é uma plataforma completa e containerizada para gerenciamento de testes de software, controle de evidências e métricas de qualidade.

---

## 🚀 Funcionalidades da Versão 1.0.0
*   **Gestão de Projetos e Demandas**: Controle total do ciclo de vida, agrupando funcionalidades em níveis lógicos e organizados.
*   **Evidências Inteligentes**: Upload múltiplo simultâneo, visualização em galeria integrada e separação sistêmica entre testes.
*   **Deep Clone**: Duplicação imediata e profunda de projetos para cenários de teste de regressão versão-a-versão.
*   **Segurança e RBAC**: Autenticação restrita JWT. Diferenciação lógica estrita entre Administradores (Gestor Total) e Analistas (Executores operacionais). *Admins só podem ser criados por admins.*
*   **Auditoria Transparente**: Painel silencioso interativo para administradores rastrearem quem criou, apagou ou editou cada campo do software em tempo real (Comparação de Diff).
*   **Atualização On-Air Segura**: Sistema nativo que verifica e sinaliza pacotes de updates e possibilita que os administradores forcem pull/reinicialização via *Watchtower* com 1 clique (Sendo plenamente configurável via painel).
*   **Infraestrutura Otimizada**: Reversa por Nginx estritamente tipado e MongoDB persistindo relatórios locais e artefatos de mídia.

---

## 📦 Instalação do Deploy para Produção

Para instalar o TestFlow em um servidor de produção **sem precisar de código-fonte nem Node.js**, preparamos um repositório satélite apenas com a imagem compilada, focado 100% em ser prático:

1. Clone o repositório de produção em seu ambiente de nuvem ou servidor físico:
   ```bash
   git clone https://github.com/JoaoVictor-M/testflow-prod.git
   ```
2. Acesse a pasta do projeto:
   ```bash
   cd testflow-prod
   ```
3. Garanta que você possui `docker` e `docker-compose` instalados no Host. Então suba a aplicação desvinculada (Detached):
   ```bash
   docker compose up -d
   ```

A partir desse momento, as imagens mais recentes do Github Container Registry (`ghcr.io`) serão orquestradas para rodarem via porta `80` (HTTP web).

---

## 🗑️ Como Desinstalar / Zerar o Sistema

Caso precise limpar completamente o banco de dados do TestFlow (voltar ao estado zero, formato de fábrica) ou excluí-lo por completo de sua máquina/servidor, o procedimento é extremamente simples por conta de sua natureza *containerizada*.

**Para apenas derrubar a aplicação (mantendo os dados salvos):**
```bash
docker compose down
```

**Para desinstalar e EXCLUIR TODOS OS DADOS (Atenção: Ação Irreversível):**
Incluindo todos os uploads de evidências e o diretório interno do banco de dados, rode o comando com a flag `-v` (volumes):
```bash
docker compose down -v
```

Em seguida, simplesmente exclua a pasta do repositório onde instanciou o projeto.

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
