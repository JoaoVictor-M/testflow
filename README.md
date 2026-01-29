# TestFlow - Gestão de Qualidade e Testes

O **TestFlow** é uma plataforma completa e containerizada para gerenciamento de testes de software, controle de evidências e métricas de qualidade.

---

## 📦 Instalação

### Linux (Servidores Debian/Ubuntu/CentOS)
A instalação é feita através do pacote de distribuição (sem código fonte exposto).

1.  **Baixe e Extraia o Pacote**:
    *   Transfira o arquivo `testflow-linux-v1.0.0.tar.gz` para o servidor.
    *   Extraia:
    ```bash
    tar -xzvf testflow-linux-v1.0.0.tar.gz
    cd testflow-dist
    ```
2.  **Execute a instalação**:
    ```bash
    sudo make install
    ```
    Isso irá:
    *   Verificar o Docker.
    *   Instalar arquivos no **diretório atual**.
    *   Configurar o serviço `testflow` para iniciar com o sistema.

Para remover: `sudo make uninstall`

### Windows (Server ou Desktop)

1.  **Instalação**:
    *   Execute o arquivo `TestFlowInstaller.exe` (fornecido junto com este pacote).
    *   O instalador irá configurar o ambiente em `C:\TestFlow` e iniciar o sistema automaticamente.

2.  **Acesso**:
    *   Aguarde alguns instantes e acesse: `http://localhost/testflow`


### Acesso
Após iniciar, o sistema estará disponível em:
*   **URL**: `http://localhost/testflow` (ou o IP do seu servidor)
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
