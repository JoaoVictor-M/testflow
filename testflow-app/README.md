# Projeto TestFlow (v0.2)

## Visão Geral

TestFlow é uma ferramenta interna de gestão de cenários de teste, desenvolvida para substituir o uso de planilhas do Excel na área de Análise de Qualidade. O objetivo é centralizar, organizar e facilitar a colaboração na criação e manutenção de casos de teste, fornecendo uma base sólida para a evolução dos processos na empresa.

## Problema a ser Resolvido

O uso de planilhas para gerenciamento de testes apresenta várias limitações:
- Dificuldade na rastreabilidade e versionamento.
- Falta de um repositório centralizado, gerando inconsistências.
- Ausência de métricas e relatórios sobre a cobertura e execução de testes.
- Processo manual e propenso a erros.

## Stack de Tecnologias (Versão MVP)

- **Backend:** Node.js com Express.js
- **Banco de Dados:** MongoDB
- **Frontend:** React (ou Vue.js)
- **Containerização:** Docker
- **Orquestração:** Kubernetes

## Pré-requisitos de Instalação (Ambiente de Desenvolvimento)

- [Visual Studio Code](https://code.visualstudio.com/download)
- [Node.js (versão LTS)](https://nodejs.org/en/)
- [Git](https://git-scm.com/downloads)
- [Postman](https://www.postman.com/downloads/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

## Como Rodar o Projeto Localmente

Tudo roda em Docker; não há Node nem MongoDB para instalar na máquina. Na raiz do repositório:

```bash
sh scripts/dev.sh up
```

O comando sobe MongoDB, API e front com recarga automática ao salvar. A API fica em
`http://localhost:3000` e o front em `http://localhost:5173/testflow/`; o MongoDB não é publicado.
Para parar, `sh scripts/dev.sh down`; para ver os logs, `sh scripts/dev.sh logs`.

## Endpoints da API (v0.4)

### Cenários de Teste (`/api/scenarios`)

-   #### `POST /api/scenarios`
    -   **Descrição:** Cria um novo cenário de teste.
    -   **Corpo (Body):**
        ```json
        {
            "title": "string (obrigatório)",
            "description": "string (obrigatório)",
            "steps": ["string", "...", " (obrigatório)"],
            "expectedResult": "string (obrigatório)"
        }
        ```
    -   **Resposta de Sucesso:** `201 Created` com o objeto do cenário criado.

-   #### `GET /api/scenarios`
    -   **Descrição:** Lista todos os cenários de teste cadastrados.
    -   **Corpo (Body):** Nenhum.
    -   **Resposta de Sucesso:** `200 OK` com um array de objetos de cenário.

-   #### `GET /api/scenarios/:id`
    -   **Descrição:** Busca um único cenário de teste pelo seu ID.
    -   **Parâmetro de URL:** `id` (string, obrigatório) - O ID do cenário a ser buscado.
    -   **Corpo (Body):** Nenhum.
    -   **Resposta de Sucesso:** `200 OK` com o objeto do cenário encontrado.
    -   **Resposta de Erro:** `404 Not Found` se o ID não existir.

...
-   #### `GET /api/scenarios/:id`
    -   **Descrição:** Busca um único cenário de teste pelo seu ID.
    ...

-   #### `PUT /api/scenarios/:id`
    -   **Descrição:** Atualiza um cenário de teste existente.
    -   **Parâmetro de URL:** `id` (string, obrigatório) - O ID do cenário a ser atualizado.
    -   **Corpo (Body):** Um objeto JSON com a estrutura completa do cenário.
    -   **Resposta de Sucesso:** `200 OK` com o objeto do cenário atualizado.
    -   **Resposta de Erro:** `404 Not Found` se o ID não existir, `400 Bad Request` se os dados forem inválidos.