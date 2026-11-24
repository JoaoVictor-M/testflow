# Entradas de build e atualização de versões

`scripts/check.sh quality` verifica instalações limpas e independentes para CI e build, incluindo
o subconjunto de produção do backend (`npm ci --omit=dev`). As versões resolvidas e integridades
vêm dos locks v3. Use `npm ci`; alterações de dependências exigem revisão conjunta de manifesto e
lock. Não regenere o lock durante um build nem copie `node_modules` do host.

Node **20.20.2** e npm **10.8.2** ficam fixados pela imagem com tag e digest em `scripts/check.sh`.
Os workflows chamam esse mesmo script em Docker. `engines` e `npm ci --engine-strict` recusam
versões abaixo do mínimo; `packageManager` registra a versão exata do npm usada na validação. O Mongoose permanece
na linha 8 e no lock existente; nenhum pacote foi atualizado nesta mudança.

`scripts/check.sh build-inputs` compara árvores de duas instalações em diretórios temporários,
valida pacotes instalados contra o lock e compara o backend de produção com o subconjunto do CI.
Os relatórios em `reports/build-inputs/` registram Node, npm, plataforma, imagem e SHA-256 de
manifesto, lock, configuração npm e árvores. Os workflows os publicam como artefato. Comparações
de árvores exigem a mesma plataforma/arquitetura (dependências opcionais variam por plataforma).

Os Compose principal e de testes fixam MongoDB **9.0.4** pelo mesmo digest; o de desenvolvimento
herda essa referência do principal, impedindo atualizações implícitas;
o banco dos testes usa essa mesma versão em armazenamento descartável. Essa fixação não migra,
recria nem abre volumes existentes. Antes de aplicar o Compose a outra instalação, confira a
versão real do servidor e o `featureCompatibilityVersion`; interrompa se forem incompatíveis.

O patch 9.0.4 corrige a identificação de kernels Ubuntu 7.0 com a correção upstream 7.0.14
([SERVER-131779](https://jira.mongodb.org/browse/SERVER-131779)). O healthcheck permanece igual.
`scripts/mongo-startup.test.sh` reproduz essa identidade em uma biblioteca carregada somente no
teste, compila em Docker e verifica inicialização, ping e leitura/escrita em tmpfs descartável.
Ele integra `quality`; nenhum volume persistido é aberto pelo teste.

Revise versões, digests, suporte oficial e avisos de segurança a cada release e mensalmente;
correções urgentes entram assim que disponíveis. Atualize tag e digest juntos, compare os
relatórios e rode `quality` e `all`, incluindo os smokes de login, ODM e mensagens SMTP.
As bases de runtime e build dos Dockerfiles usam Node **20.20.2** e npm **10.8.2**, como o CI,
com os mesmos manifests/locks e `npm ci --engine-strict` (backend de produção com `--omit=dev`).
O backend preserva a variante Alpine e o frontend a base Debian; ambas têm tag exata e digest.
Os testes de repositório verificam esse alinhamento e a remoção do antigo Compose auxiliar.

Node 20 está [fora de suporte](https://nodejs.org/en/about/previous-releases). Sua manutenção
aqui preserva a compatibilidade enquanto a migração coordenada para uma LTS suportada é
validada em runtime, build e CI; esta fixação não equivale a suporte de segurança.
Mudanças maiores de Node ou MongoDB exigem decisão explícita de compatibilidade. Para MongoDB,
consulte o [caminho oficial de upgrade](https://www.mongodb.com/docs/mongodb-versions/) e o
[ciclo de suporte](https://www.mongodb.com/legal/support-policy/lifecycles), valide backup e
restauração e ensaie com cópia isolada dos dados antes de abrir o volume persistido.
