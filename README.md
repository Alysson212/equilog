# EquiLog

Protótipo acadêmico de registro integrado de saúde, manejo, treinamento e
desempenho de equinos atletas da modalidade de três tambores, com controle de
acesso baseado em papéis. Acompanha o Trabalho de Curso de Ciência da Computação
(UNIP, Polo Paraisópolis).

A referência normativa do código é [`docs/ESPECIFICACAO.md`](docs/ESPECIFICACAO.md).
O sistema registra informações fornecidas por pessoas e não faz nenhuma inferência
clínica, sugestão ou recomendação de conduta (RNF11).

## Estrutura

```
equilog/
├── servico/          # API REST (Node.js 20, Express 4, Prisma, PostgreSQL 16)
├── aplicativo/       # aplicação móvel (Flutter)
├── dados-de-teste/   # massa padronizada das sessões de avaliação
├── docs/             # especificação e sequência de trabalho
└── docker-compose.yml
```

## Pré-requisitos

- Docker Engine com o plugin Compose (no Windows, dentro do WSL2)
- Node.js 20 LTS, para executar o Prisma e os testes fora do contêiner
- Git

## Configuração

1. Copie os modelos de variáveis de ambiente e defina uma senha própria para o
   banco, a mesma nos dois arquivos:

   ```sh
   cp .env.example .env
   cp servico/.env.example servico/.env
   ```

   Os arquivos `.env` não são versionados.

2. Instale as dependências do serviço (necessário para usar o Prisma no hospedeiro):

   ```sh
   cd servico
   npm ci
   ```

## Execução

Na raiz do repositório:

```sh
docker compose up -d --build
```

O contêiner do serviço gera o certificado autoassinado se ele não existir
(`servico/scripts/gerar-certificado.sh`), aplica as migrações pendentes e sobe:

| Porta | Protocolo | Comportamento |
|---|---|---|
| 3443 | HTTPS | API do EquiLog |
| 3080 | HTTP | responde 426 Upgrade Required a qualquer requisição (RNF02) |
| 5432 | PostgreSQL | banco de dados |

### Carga inicial

Com o banco no ar, a partir de `servico/`:

```sh
npx prisma migrate deploy   # aplica as migrações (o contêiner também faz isso)
npx prisma db seed          # papel, permissao, papel_permissao e tipo_evento
```

O seed é idempotente. As permissões são derivadas da matriz em
`servico/src/dominio/matrizPermissoes.js`, que transcreve a seção 4 da
especificação.

### Verificação do canal cifrado (RNF02)

```sh
curl -k https://127.0.0.1:3443/saude-servico   # 200 {"situacao":"ativo"}
curl    http://127.0.0.1:3080/saude-servico    # 426 Upgrade Required
```

## Testes do serviço

A partir de `servico/`, com o banco no ar:

```sh
npm test                 # unidade e integração
npm run test:cobertura   # idem, com relatório de cobertura em coverage/
```

A suíte usa um banco exclusivo (`DATABASE_URL_TESTE`), que precisa ter nome
terminado em `_teste`; outro nome é recusado, para que a base de desenvolvimento
nunca seja apagada por engano. Antes da suíte, as migrações e o seed são aplicados
nesse banco; antes de cada teste, os dados de uso são apagados.

## Endpoints

Todos sob HTTPS. Autorização resolvida no servidor a cada requisição, pela tripla
usuário, animal e papel vigente (seção 4 da especificação).

| Método | Caminho | Finalidade | RF |
|---|---|---|---|
| POST | `/auth/login` | Autenticar e emitir tokens | RF02 |
| POST | `/auth/refresh` | Renovar token de acesso | RF03 |
| POST | `/usuarios` | Cadastrar usuário (devolve o código de recuperação uma única vez) | RF01 |
| POST | `/auth/recuperar-senha` | Nova senha com o código de recuperação (decisão 9.7) | RF01, RF02 |
| GET | `/animais` | Listar animais com vínculo vigente | RF08 |
| POST | `/animais` | Cadastrar animal | RF04 |
| GET | `/animais/{id}` | Consultar animal | RF08 |
| PATCH | `/animais/{id}` | Editar ou inativar animal | RF05 |
| GET | `/animais/{id}/eventos` | Linha do tempo com filtros e paginação | RF13, RF14 |
| POST | `/animais/{id}/eventos` | Registrar evento | RF09 a RF12, RF17 |
| PATCH | `/eventos/{id}` | Editar evento próprio | RF15 |
| DELETE | `/eventos/{id}` | Exclusão lógica | RF16 |
| POST | `/eventos/{id}/anexos` | Anexar arquivo (campo `arquivo`, até 10 MB) | RF20 |
| POST | `/animais/{id}/acessos` | Conceder vínculo | RF06 |
| DELETE | `/acessos/{id}` | Revogar vínculo | RF07 |
| GET | `/lembretes` | Listar lembretes do usuário | RF18 |
| PATCH | `/lembretes/{id}` | Alterar estado do lembrete | RF19 |
| GET | `/animais/{id}/auditoria` | Consultar trilha de auditoria | RF23 |
| GET | `/animais/{id}/exportacao` | Exportar histórico em PDF | RF22 |
| GET | `/animais/{id}/acessos` | Listar vínculos do animal (proprietário) | RF06, RF07 |
| GET | `/anexos/{id}` | Baixar anexo | RF20 |
| POST | `/sincronizacao/lote` | Enviar lote de eventos pendentes | RF21 |
| GET | `/tipos-evento` | Tipos de evento por domínio | RF09 a RF12 |

## Aplicativo móvel

Flutter, Android 9 (API 28) ou superior. A partir de `aplicativo/`:

```sh
# o app confia no certificado de desenvolvimento somente se ele estiver empacotado
cp ../servico/certs/servidor.crt assets/certificados/servidor.crt

flutter test                 # unidade e sincronização (CT09 a CT11) contra o servidor no ar
flutter build apk --release  # build/app/outputs/flutter-apk/app-release.apk
```

O endereço padrão do serviço é `https://10.0.2.2:3443`, que é a máquina
hospedeira vista pelo emulador Android. Em aparelho físico, compile com
`--dart-define=API_URL=https://<ip-da-maquina>:3443`.

Os testes de sincronização usam o serviço real em `https://127.0.0.1:3443`
(variável `EQUILOG_API_URL`) e criam usuários de teste na base de desenvolvimento.
A única coisa simulada é a falta de rede no aparelho.

## Massa de teste e CT12

A partir da raiz do repositório, com o serviço no ar:

```sh
node dados-de-teste/reinicializar.js --confirmar  # estado padronizado das sessões (seção 8)
node dados-de-teste/carregar-ct12.js               # +500 eventos em "Estrela do Sul"
node dados-de-teste/medir-ct12.js                  # mede a linha do tempo (RNF05)
```

`reinicializar.js` **apaga todos os dados de uso** da base local e cria 2 animais,
30 eventos nos quatro domínios e um usuário por papel
(`proprietario@`, `veterinario@`, `treinador@` e `manejo@sessao.equilog`), com a
senha da variável `SENHA_SESSAO` ou a padrão do script. Cada usuário recebe um
código de recuperação de senha novo, exibido ao final da execução. Os scripts recusam
bancos que não sejam locais.

## Banco de dados

O esquema é versionado em `servico/prisma/migrations/`. Além das tabelas geradas a
partir de `schema.prisma`, as migrações contêm acréscimos manuais que o Prisma não
representa:

- o índice parcial `idx_evento_animal_data`, que sustenta a linha do tempo (RF13);
- a restrição `CHECK` dos domínios de `tipo_evento`;
- a restrição `CHECK` dos estados de `lembrete`;
- a restrição `CHECK` do sexo do animal (`M`, `F` ou `C`).

Para alterar o esquema, crie a migração com `npx prisma migrate dev --create-only`,
revise o SQL gerado e aplique com `npx prisma migrate deploy`.

## Observações sobre o ambiente Windows

Foi usado Docker Engine dentro do WSL2 (distribuição Ubuntu 24.04), sem Docker
Desktop. Para que as portas do contêiner fiquem acessíveis em `127.0.0.1` no
Windows e o WSL não desligue por ociosidade, o arquivo `%USERPROFILE%\.wslconfig`
contém:

```ini
[wsl2]
networkingMode=mirrored
vmIdleTimeout=-1

[general]
instanceIdleTimeout=-1

[experimental]
hostAddressLoopback=true
```

Os comandos do Compose são executados de dentro do WSL, por exemplo:

```powershell
wsl -d Ubuntu-24.04 --cd /mnt/c/projetos/equilog -- docker compose up -d
```

Use `127.0.0.1`, e não `localhost`, na `DATABASE_URL` do hospedeiro: `localhost`
resolve primeiro para IPv6, que não é encaminhado.

### Problemas observados após reiniciar o Windows

- **WSL não inicia com erro 0x8007054f** (rede espelhada): reinicie o serviço de
  rede de contêineres em um PowerShell como administrador, `Restart-Service hns`, e
  abra o WSL de novo.
- **Docker não consegue publicar as portas 3080, 3443 ou 5432** ("bind: An attempt
  was made to access a socket in a way forbidden"): o Windows reservou faixas
  dinâmicas que cobrem essas portas (`netsh int ipv4 show excludedportrange
  protocol=tcp`). Como administrador, reserve as três portas para uso próprio, de
  forma persistente:

  ```powershell
  net stop winnat
  foreach ($p in 3080, 3443, 5432) {
    netsh int ipv4 add excludedportrange protocol=tcp startport=$p numberofports=1 store=persistent
  }
  net start winnat
  ```

- **Serviço parado em `P1001`** (não alcança o banco) depois que o banco voltou:
  recrie só o contêiner do serviço, `docker compose up -d --force-recreate servico`.

## Dependências e alertas conhecidos

`npm audit` aponta alertas em duas ferramentas de desenvolvimento, nenhum no
código executado pela API:

- `prisma` (CLI), via `deepmerge-ts`: o caminho afetado só mescla o arquivo de
  configuração do próprio Prisma e não processa entrada de usuário;
- `jest` e suas dependências: executados apenas na suíte de testes.

## Versões

| Componente | Versão |
|---|---|
| Node.js | 20.20.2 |
| Express | 4.22.3 |
| PostgreSQL | 16.15 (imagem oficial `postgres:16`) |
| Prisma e @prisma/client | 6.19.3 |
| bcrypt | 6.0.0 |
| jsonwebtoken | 9.0.3 |
| multer | 2.4.0 |
| pdfkit | 0.20.2 |
| Flutter / Dart | 3.47.7 / 3.13.5 |
| sqflite | 2.4.4+1 |
| http | 1.6.0 |
| flutter_secure_storage | 11.2.0 |
| flutter_local_notifications | 22.3.2 |
| connectivity_plus | 7.3.2 |
| Jest | 30.5.2 |
| supertest | 7.3.1 |
