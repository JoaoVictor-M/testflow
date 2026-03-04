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

Execute o comando abaixo no terminal do seu servidor ou nuvem para baixar os arquivos necessários e subir o sistema:
   ```bash
   git clone https://github.com/JoaoVictor-M/testflow-prod.git testflow && cd testflow && docker compose up -d
   ```

A partir desse momento, as imagens mais recentes do Github Container Registry (`ghcr.io`) serão orquestradas para rodarem via porta `80` (HTTP web).

---

## 🗑️ Como Desinstalar / Zerar o Sistema

Caso precise limpar completamente o banco de dados do TestFlow (voltar ao estado zero, formato de fábrica) ou excluí-lo por completo de sua máquina/servidor, o procedimento é extremamente simples por conta de sua natureza *containerizada*.

**Para apenas derrubar a aplicação (mantendo os dados salvos):**
```bash
docker compose down
```

**Para desinstalar e EXCLUIR TODOS OS DADOS E A PASTA (Atenção: Ação Irreversível):**
Isso inclui todos os uploads de evidências e os dados salvos internamente. No mesmo diretório execute:
*No Linux/Mac:*
```bash
docker compose down -v && cd .. && rm -rf testflow
```
*No Windows (PowerShell):*
```powershell
docker compose down -v ; cd .. ; Remove-Item -Recurse -Force testflow
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
