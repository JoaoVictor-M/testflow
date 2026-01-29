# TestFlow - Gestão de Qualidade e Testes

O **TestFlow** é uma plataforma completa e containerizada para gerenciamento de testes de software, controle de evidências e métricas de qualidade.

---

## 📦 Instalação

### Linux (Servidores Debian/Ubuntu/CentOS)
A instalação é feita via **Make**, garantindo configuração correta do serviço systemd.

1.  Clone o repositório (ou baixe o código):
    ```bash
    git clone git@github.com:JoaoVictor-M/testflow.git
    cd testflow
    ```
2.  Execute a instalação como root:
    ```bash
    sudo make install
    ```
    Isso irá:
    *   Verificar o Docker.
    *   Instalar arquivos em `/opt/testflow`.
    *   Configurar o serviço `testflow` para iniciar com o sistema.

Para remover: `sudo make uninstall`

### Windows (Server ou Desktop)
Para Windows, fornecemos um script para geração de instalador nativo (`.exe`).

1.  **Requisito de Construção**: Instale o [Inno Setup](https://jrsoftware.org/isinfo.php).
2.  **Gerar Instalador**:
    *   Abra o arquivo `windows-installer/setup.iss`.
    *   Clique em "Compile".
    *   O arquivo `TestFlow_Setup_v1.0.0.exe` será gerado na pasta `windows-installer/Output`.
3.  **Para o Cliente Final**:
    *   Basta entregar o `.exe` e executar. O instalador cuida de tudo.


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
