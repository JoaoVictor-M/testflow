# TestFlow — Instruções para agentes

## Contexto

Este repositório contém o código-fonte do TestFlow.

A documentação oficial do produto fica em um cofre Obsidian
separado, acessível localmente por `.testflow-docs/`.

O vínculo `.testflow-docs` é específico de cada computador e
não deve ser versionado.

## Consulta à documentação

Antes de analisar ou implementar uma funcionalidade:

1. Consultar `.testflow-docs/00-Mapa-do-Conhecimento.md`.
2. Consultar `.testflow-docs/00-Guia-de-Governanca.md`.
3. Localizar as regras de negócio pertinentes à tarefa.
4. Consultar auditorias, pareceres e ADRs quando relevantes.
5. Verificar as decisões e o status de aprovação antes de agir.

Se o cofre não estiver acessível, informar a limitação.
Não inventar regras nem assumir que a documentação foi consultada.

## Fontes de verdade

- Regras de negócio aprovadas orientam o comportamento esperado.
- Auditorias registram evidências e problemas identificados.
- Pareceres podem conter recomendações ainda não aprovadas.
- ADRs aceitos registram decisões arquiteturais.
- O backlog aprovado define o trabalho autorizado.

Não interpretar automaticamente um documento consolidado
marcado como "em-validacao" como totalmente aprovado.

Em caso de conflito ou dúvida sobre uma decisão, sinalizar
a divergência antes de implementar.

## Limites de atuação

- Ler a documentação oficial conforme a tarefa.
- Não modificar o cofre sem autorização explícita.
- Não alterar documentos históricos da auditoria para
  acomodar mudanças de implementação.
- Não modificar código sem uma tarefa autorizada.
- Respeitar alterações locais preexistentes no Git.
- Não executar operações destrutivas, deploy ou alterações
  em produção sem autorização.

## Ferramentas

A leitura direta dos arquivos Markdown é o método principal.

As Bases podem ser lidas como arquivos de configuração ou
consultadas pela CLI do Obsidian quando disponível.

O trabalho não deve depender de o aplicativo Obsidian estar aberto.

## Entrega

Ao concluir uma tarefa, informar:

- O que foi analisado ou alterado.
- Quais documentos fundamentaram o trabalho.
- Quais testes foram executados.
- Pendências, riscos ou decisões que exigem aprovação.
