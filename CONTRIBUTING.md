# Como Contribuir para o TestFlow

Obrigado por se interessar em contribuir para o TestFlow! Qualquer ajuda é bem-vinda para tornar a nossa ferramenta de Gestão de Qualidade ainda melhor.

## Código de Conduta
Por favor, leia nosso [Código de Conduta](CODE_OF_CONDUCT.md) antes de interagir com a comunidade. Siga as diretrizes para manter um ambiente saudável e respeitoso.

## Reportando Bugs
Se você encontrou um bug, por favor abra uma *Issue* no repositório descrevendo:
- Os passos para reproduzir o problema.
- O comportamento esperado.
- O comportamento atual ocorrido.
- Seu ambiente (Sistema Operacional, Navegador, Versão do Docker).

## Sugerindo Novas Funcionalidades
Toda ideia construtiva é válida! Abra uma *Issue* com a tag `enhancement` e explique detalhadamente como essa funcionalidade ajudaria os usuários de QA e Engenharia.

## Ambiente de Desenvolvimento Local

O TestFlow usa Docker para garantir um ambiente fácil e padronizado.

1. Faça um **Fork** do repositório para a sua conta e clone-o localmente:
   ```bash
   git clone https://github.com/SEU-USUARIO/testflow.git
   ```
2. Crie uma branch para sua modificação:
   ```bash
   git checkout -b feature/nome-da-sua-feature
   ```
3. Suba os containers locais em modo de desenvolvimento:
   ```bash
   docker-compose up -d --build
   ```
   > *O backend rodará na porta 3000, e o frontend Vite ficará acessível via proxy Nginx.*

## Padrões de Commit
Utilizamos Conventional Commits (ex: `feat:`, `fix:`, `docs:`, `chore:`). Por favor, garanta que suas mensagens de commit sejam claras.

## Submetendo um Pull Request (PR)
1. Certifique-se de que os testes locais não foram quebrados.
2. Atualize o `README.md` caso sua modificação adicione novas variáveis de ambiente.
3. Faça o push para a sua branch enviando para o seu fork:
   ```bash
   git push origin feature/nome-da-sua-feature
   ```
4. Abra o PR apontando para a branch `development` do repositório original.

## Licença (Atenção)
Ao contribuir, você concorda que suas modificações serão licenciadas sob a **AGPLv3 com Commons Clause** (disponível no arquivo `LICENSE`). Você também entende que a venda ou distribuição do software modificado ou original como SaaS (Software as a Service) pago é proibida.
