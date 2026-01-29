# TestFlow - Gestão de Qualidade e Testes

O **TestFlow** é uma plataforma completa e containerizada para gerenciamento de testes de software, controle de evidências e métricas de qualidade.

Este repositório contém os arquivos de instalação para implantar a versão de produção do TestFlow usando Docker.

---

## 🛠️ Pré-requisitos

Para executar o TestFlow, você precisa ter instalado no seu servidor:

*   **[Docker Engine](https://docs.docker.com/engine/install/)** (para Linux) ou **[Docker Desktop](https://docs.docker.com/desktop/)** (para Windows/Mac).
*   **[Docker Compose](https://docs.docker.com/compose/install/)** (Geralmente já incluído nas instalações recentes do Docker).

---

## 🚀 Como Instalar

Siga os passos abaixo de acordo com o seu sistema operacional.

### 🐧 Instalação no Linux (Ubuntu/Debian/CentOS)

1.  **Clone este repositório** ou baixe apenas os arquivos `docker-compose.yml` e `mongo-init.js` para uma pasta de sua preferência (ex: `/opt/testflow`).

    ```bash
    git clone https://github.com/JoaoVictor-M/testflow-prod.git testflow
    cd testflow
    ```

    *Caso não queira usar git, apenas crie uma pasta e coloque os dois arquivos dentro dela.*

2.  **Verifique as permissões** (Opcional, mas recomendado para o script de banco):
    Certifique-se de que o arquivo `mongo-init.js` tem permissão de leitura.

3.  **Inicie a aplicação**:
    Dentro da pasta onde estão os arquivos, execute:

    ```bash
    sudo docker compose up -d
    ```

    Isso fará o download das imagens oficiais mais recentes e iniciará os containers em segundo plano.

### 🪟 Instalação no Windows

1.  Certifique-se de que o **Docker Desktop** está rodando.

2.  **Baixe os arquivos**:
    *   Clone o repositório ou baixe o ZIP e extraia em uma pasta (ex: `C:\TestFlow`).

3.  **Abra o Terminal (PowerShell ou CMD)**:
    Navegue até a pasta onde salvou os arquivos.

    ```powershell
    cd C:\TestFlow
    ```

4.  **Inicie a aplicação**:
    Execute o comando:

    ```powershell
    docker compose up -d
    ```

---

## 📦 O que está sendo instalado?

Ao rodar o comando acima, o Docker criará os seguintes serviços:

*   **testflow-frontend**: Interface web da aplicação (Porta **80**).
*   **testflow-backend**: API do sistema (Porta **3000** - uso interno).
*   **mongodb-service**: Banco de dados MongoDB (Porta **27017**).

Todos os dados do banco e evidências de testes são persistidos em volumes locais do Docker, garantindo que você não perca dados ao reiniciar os containers.

---

## 🌐 Acessando o Sistema

Após a instalação, abra seu navegador e acesse:

*   **URL**: `http://localhost` (ou o IP do seu servidor, ex: `http://192.168.1.50`)
