# TestFlow - Gestão de Qualidade e Testes

O **TestFlow** é uma plataforma completa e containerizada para gerenciamento de testes de software, controle de evidências e métricas de qualidade.

---

## 📦 Instalação (Servidores Linux/Windows)

Para instalar o TestFlow em um servidor de produção **sem precisar do código-fonte**, siga os passos abaixo. O sistema roda inteiramente sobre Docker.

### Pré-requisitos
*   [Docker](https://www.docker.com/) instalado.
*   [Docker Compose](https://docs.docker.com/compose/install/) instalado.

### Passo a Passo

1.  **Crie uma pasta para o sistema** no seu servidor (ex: `C:\TestFlow` ou `/opt/testflow`).
2.  **Baixe os arquivos de configuração**:
    *   Baixe o arquivo `docker-compose.prod.yml` (renomeie para `docker-compose.yml`).
    *   Baixe o script `mongo-init.js` (necessário para o banco de dados).
3.  **Execute o sistema**:
    Abra o terminal na pasta onde salvou os arquivos e rode:
    ```bash
    docker compose up -d
    ```

Isso irá baixar as imagens oficiais do sistema (Frontend e Backend) e iniciar o banco de dados MongoDB automaticamente.

### Acesso
Após iniciar, o sistema estará disponível em:
*   **URL**: `http://localhost` (ou o IP do seu servidor)
*   **Login Padrão**: (Consulte o administrador para credenciais iniciais ou script de seed)

---

## 🛠️ Desenvolvimento (Para mantenedores)

Se você tem acesso ao código-fonte e deseja contribuir:

1.  Clone o repositório:
    ```bash
    git clone git@github.com:JoaoVictor-M/testflow.git
    ```
2.  Inicie em modo de desenvolvimento (build local):
    ```bash
    docker compose up -d --build
    ```

---

## 🚀 Funcionalidades da Versão 1.0.0
*   **Gestão de Projetos e Demandas**: Controle total do ciclo de vida.
*   **Evidências**: Upload múltiplo e galeria integrada.
*   **Deep Clone**: Duplicação inteligente de projetos para regressão.
*   **Segurança**: Autenticação JWT e RBAC (Admin/QA).
*   **Infraestrutura**: Nginx otimizado e MongoDB persistente.
