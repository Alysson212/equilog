# Especificação do EquiLog

Fonte: Capítulo 4 do Trabalho de Curso. Esta é a referência normativa do código.
Qualquer alteração aqui precisa ser refletida no documento, e vice-versa.

---

## 1. Requisitos funcionais

Prioridade alta compõe obrigatoriamente o protótipo. Média entra se o prazo
permitir. Baixa fica para trabalhos futuros.

| ID | Descrição | Prioridade |
|---|---|---|
| RF01 | Cadastro de usuário com nome, e-mail, telefone e senha | Alta |
| RF02 | Autenticação por e-mail e senha, emitindo token de acesso | Alta |
| RF03 | Renovação do token de acesso sem nova digitação de senha | Média |
| RF04 | Proprietário cadastra animal com nome, registro, data de nascimento, sexo e pelagem | Alta |
| RF05 | Proprietário edita e inativa o cadastro de um animal | Média |
| RF06 | Proprietário concede acesso a outro usuário, informando papel e período de vigência | Alta |
| RF07 | Proprietário revoga acesso concedido, com efeito imediato | Alta |
| RF08 | Listar os animais aos quais o usuário autenticado possui vínculo vigente | Alta |
| RF09 | Registro de evento de saúde com procedimento, produto, dose, via, profissional e data de retorno | Alta |
| RF10 | Registro de evento de manejo com categoria, descrição e quantidade | Alta |
| RF11 | Registro de evento de treinamento com tipo de exercício, duração, intensidade e piso | Alta |
| RF12 | Registro de evento de competição com prova, local, categoria, tempo, colocação e penalidade | Alta |
| RF13 | Linha do tempo do animal em ordem cronológica decrescente | Alta |
| RF14 | Filtrar a linha do tempo por domínio, período e autor do registro | Alta |
| RF15 | Edição de evento pelo próprio autor, mantendo histórico de alteração | Média |
| RF16 | Exclusão lógica de evento pelo autor ou pelo proprietário | Média |
| RF17 | Geração automática de lembrete quando o evento contiver data de retorno | Alta |
| RF18 | Notificação no dispositivo na data prevista do lembrete | Alta |
| RF19 | Marcar lembrete como cumprido, adiado ou cancelado | Média |
| RF20 | Anexar arquivo de imagem ou documento a um evento | Média |
| RF21 | Registro de eventos sem conexão, com sincronização posterior automática | Alta |
| RF22 | Exportar o histórico do animal em arquivo portátil | Média |
| RF23 | Proprietário consulta a trilha de auditoria dos acessos ao animal | Baixa |
| RF24 | Comparação gráfica de tempos obtidos em provas ao longo do tempo | Baixa |

## 2. Requisitos não funcionais

| ID | Característica ISO/IEC 25010 | Descrição | Verificação |
|---|---|---|---|
| RNF01 | Segurança | Senhas apenas como resumo criptográfico com sal e custo ajustável | Inspeção do esquema e do código de credenciais |
| RNF02 | Segurança | Comunicação exclusivamente em canal cifrado | Requisição em canal não cifrado é rejeitada |
| RNF03 | Segurança | Autorização verificada no servidor para toda operação | Requisição direta sem o cliente oficial |
| RNF04 | Segurança | Toda escrita e toda negação registradas em auditoria | Inspeção dos registros após os casos de teste |
| RNF05 | Eficiência | Linha do tempo com 500 eventos em até 2 s em banda larga móvel | Medição com massa de teste |
| RNF06 | Confiabilidade | Registro sem conexão não se perde | Modo avião seguido de reconexão |
| RNF07 | Usabilidade | Evento de rotina não exige mais de 5 campos obrigatórios | Inspeção dos formulários |
| RNF08 | Usabilidade | Mensagens de erro compreensíveis por não especialista | Inspeção e sessões de avaliação |
| RNF09 | Portabilidade | Executa em Android 9 ou superior | Dispositivo físico e emulador |
| RNF10 | Manutenibilidade | Serviço em camadas, com rotas, domínio e persistência separados | Inspeção da estrutura |
| RNF11 | Adequação funcional | Nenhuma sugestão, diagnóstico ou recomendação clínica | Inspeção funcional e revisão das telas |
| RNF12 | Segurança | Apenas os dados pessoais necessários à finalidade | Revisão do modelo frente à finalidade |

## 3. Modelo de dados

Estratégia de supertipo e subtipos: `evento` concentra os atributos comuns e
quatro tabelas especializadas guardam os específicos, ligadas por chave primária
compartilhada. Motivo: a linha do tempo é a consulta mais frequente e resolve-se
com uma varredura única; os atributos específicos permanecem onde podem ser
declarados obrigatórios; um novo domínio não altera as consultas existentes.

### Entidades

**usuario**: `id` UUID PK, `nome` VARCHAR(120) NN, `email` VARCHAR(160) NN UK,
`senha_hash` VARCHAR(255) NN, `telefone` VARCHAR(20), `ativo` BOOLEAN NN,
`criado_em` TIMESTAMPTZ NN.

**papel**: `id` SERIAL PK, `nome` VARCHAR(40) NN UK, `descricao` VARCHAR(160).
Carga inicial: `proprietario`, `veterinario`, `treinador`, `manejo`.

**permissao**: `id` SERIAL PK, `codigo` VARCHAR(60) NN UK, `descricao` VARCHAR(160).

**papel_permissao**: `papel_id` FK, `permissao_id` FK, PK composta.

**animal**: `id` UUID PK, `nome` VARCHAR(120) NN, `registro_associacao` VARCHAR(40),
`data_nascimento` DATE, `sexo` CHAR(1) NN (`M` macho inteiro, `F` fêmea, `C`
macho castrado), `pelagem` VARCHAR(60), `proprietario_id` UUID FK → usuario NN,
`ativo` BOOLEAN NN.

**vinculo_acesso**: `id` UUID PK, `usuario_id` FK NN, `animal_id` FK NN,
`papel_id` FK NN, `data_inicio` DATE NN, `data_fim` DATE (nulo = indeterminada),
`concedido_por` UUID FK → usuario NN, `ativo` BOOLEAN NN.

**tipo_evento**: `id` SERIAL PK, `dominio` VARCHAR(12) NN (`saude`, `manejo`,
`treinamento`, `competicao`), `nome` VARCHAR(60) NN, `exige_retorno` BOOLEAN NN.

Carga inicial. `exige_retorno = true` apenas em tipos de saúde, porque
`data_retorno` só existe em `evento_saude`. Esse campo torna a data obrigatória no
formulário e nada mais: o sistema não calcula, não sugere e não propõe data.

| Domínio | Tipos | exige_retorno |
|---|---|---|
| saude | vacinacao, vermifugacao, procedimento odontologico | true |
| saude | consulta clinica, exame, tratamento, lesao, aplicacao de medicamento, coleta de material | false |
| manejo | alimentacao, suplementacao, casqueamento, ferrageamento, banho e higiene, limpeza de baia, troca de baia, transporte | false |
| treinamento | trabalho de tambor, trabalho de pista, condicionamento, trabalho na esteira, soltura em piquete, descanso | false |
| competicao | prova oficial, prova classificatoria, prova final, simulado de treino | false |

**evento**: `id` UUID PK (gerado no cliente), `animal_id` FK NN, `tipo_evento_id`
FK NN, `data_evento` TIMESTAMPTZ NN, `titulo` VARCHAR(140) NN, `observacao` TEXT,
`registrado_por` UUID FK NN, `versao` INTEGER NN default 1, `excluido_em`
TIMESTAMPTZ, `criado_em` TIMESTAMPTZ NN, `atualizado_em` TIMESTAMPTZ NN.

Índice obrigatório:
```sql
CREATE INDEX idx_evento_animal_data
    ON evento (animal_id, data_evento DESC)
    WHERE excluido_em IS NULL;
```

**evento_saude**: `evento_id` PK/FK, `procedimento` VARCHAR(80) NN, `produto`
VARCHAR(120), `dose` VARCHAR(40), `via` VARCHAR(40), `profissional` VARCHAR(120),
`data_retorno` DATE.

**evento_manejo**: `evento_id` PK/FK, `categoria` VARCHAR(60) NN, `descricao`
VARCHAR(200), `quantidade` NUMERIC(8,2), `unidade` VARCHAR(12).

**evento_treinamento**: `evento_id` PK/FK, `tipo_exercicio` VARCHAR(60) NN,
`duracao_min` INTEGER, `intensidade` VARCHAR(20), `piso` VARCHAR(40).

**evento_competicao**: `evento_id` PK/FK, `nome_prova` VARCHAR(140) NN, `local`
VARCHAR(140), `categoria` VARCHAR(60), `tempo_segundos` NUMERIC(6,3), `colocacao`
INTEGER, `penalidade` NUMERIC(6,3).

**evento_historico**: `id` BIGSERIAL PK, `evento_id` UUID FK NN,
`versao_anterior` INTEGER NN, `conteudo_anterior` JSONB NN, `alterado_por` UUID FK
NN, `alterado_em` TIMESTAMPTZ NN. Gravado a cada edição (RF15), antes da
atualização, com o conteúdo integral do evento e de seu subtipo no estado anterior.

**anexo**: `id` UUID PK, `evento_id` FK NN, `nome_arquivo` VARCHAR(200) NN,
`caminho` VARCHAR(300) NN, `mime_type` VARCHAR(80), `tamanho_bytes` INTEGER,
`enviado_por` UUID FK NN.

**lembrete**: `id` UUID PK, `evento_id` FK NN, `animal_id` FK NN, `data_prevista`
DATE NN, `status` VARCHAR(12) NN (`pendente`, `cumprido`, `adiado`, `cancelado`),
`criado_por` UUID FK NN.

**log_auditoria**: `id` BIGSERIAL PK, `usuario_id` UUID FK (aceita nulo),
`identificador_tentativa` VARCHAR(160), `acao` VARCHAR(40) NN, `entidade`
VARCHAR(40), `entidade_id` VARCHAR(60), `motivo` VARCHAR(60), `data_hora`
TIMESTAMPTZ NN, `endereco_ip` VARCHAR(45).

`usuario_id` aceita nulo porque uma tentativa de autenticação pode citar e-mail
inexistente. Nesse caso grava-se o e-mail digitado em `identificador_tentativa`.
Quando o usuário é identificado, `identificador_tentativa` fica nulo.

## 4. Matriz de permissões

C = criar, L = ler, E = editar o próprio registro, traço = sem permissão.

| Operação | Proprietário | Veterinário | Treinador | Manejo |
|---|---|---|---|---|
| Evento de saúde | L | C, L, E | L | - |
| Evento de manejo | C, L, E | L | L | C, L, E |
| Evento de treinamento | C, L, E | L | C, L, E | L |
| Evento de competição | C, L, E | - | C, L, E | - |
| Cadastro do animal | C, L, E | L | L | L |
| Concessão e revogação de acesso | C, L, E | - | - | - |
| Anexo de documento a evento | C, L | C, L | C, L | L |
| Lembretes do animal | L, E | C, L, E | L, E | L |
| Exportação do histórico | C, L | L | L | - |
| Trilha de auditoria do animal | L | - | - | - |

Duas decisões que não são engano e não devem ser "corrigidas": o proprietário
apenas lê o domínio de saúde, para preservar a autoria do registro clínico; e o
responsável pelo manejo não tem sequer leitura de saúde, por menor privilégio.

Na linha de lembretes, `C` cabe apenas ao veterinário porque o lembrete nasce
exclusivamente do `dataRetorno` de um evento de saúde (RF17). `E` significa alterar
o estado para cumprido, adiado ou cancelado (RF19). Criação manual de lembrete não
é requisito deste protótipo e não deve ser implementada.

## 5. Endpoints

| Método | Caminho | Finalidade | Autorização | RF |
|---|---|---|---|---|
| POST | `/auth/login` | Autenticar e emitir tokens | Público | RF02 |
| POST | `/auth/refresh` | Renovar token de acesso | Autenticado | RF03 |
| POST | `/usuarios` | Cadastrar usuário | Público | RF01 |
| GET | `/animais` | Listar animais com vínculo vigente | Todos | RF08 |
| POST | `/animais` | Cadastrar animal | Proprietário | RF04 |
| GET | `/animais/{id}` | Consultar dados do animal | Todos | RF08 |
| PATCH | `/animais/{id}` | Editar animal | Proprietário | RF05 |
| GET | `/animais/{id}/eventos` | Linha do tempo com filtros | Conforme matriz | RF13, RF14 |
| POST | `/animais/{id}/eventos` | Registrar evento | Conforme matriz e domínio | RF09 a RF12 |
| PATCH | `/eventos/{id}` | Editar evento próprio | Autor | RF15 |
| DELETE | `/eventos/{id}` | Exclusão lógica | Autor ou proprietário | RF16 |
| POST | `/eventos/{id}/anexos` | Anexar arquivo | Conforme matriz | RF20 |
| POST | `/animais/{id}/acessos` | Conceder vínculo | Proprietário | RF06 |
| DELETE | `/acessos/{id}` | Revogar vínculo | Proprietário | RF07 |
| GET | `/lembretes` | Listar lembretes do usuário | Todos | RF18 |
| PATCH | `/lembretes/{id}` | Alterar estado do lembrete | Conforme matriz | RF19 |
| POST | `/sincronizacao/lote` | Enviar lote de eventos pendentes | Todos | RF21 |
| GET | `/animais/{id}/exportacao` | Exportar histórico | Prop., vet., treinador | RF22 |
| GET | `/animais/{id}/auditoria` | Consultar auditoria | Proprietário | RF23 |
| GET | `/animais/{id}/acessos` | Listar vínculos do animal | Proprietário | RF06, RF07 |
| GET | `/anexos/{id}` | Baixar anexo | Leitura do domínio do evento | RF20 |
| GET | `/tipos-evento` | Tipos de evento com `exige_retorno` | Autenticado | RF09 a RF12 |

### Códigos de estado

200 consulta, 201 criação, 204 exclusão, 400 requisição malformada, 401 credencial
ausente ou inválida, 403 sem permissão, 404 inexistente, 409 conflito de versão na
sincronização, 422 falha de validação de domínio.

### Exemplo normativo

```http
POST /animais/8c1f.../eventos
Authorization: Bearer <token>
Content-Type: application/json

{
  "id": "3f2a7c90-5e41-4b2d-9a77-0c13ef8b4411",
  "dominio": "saude",
  "tipoEvento": "vacinacao",
  "dataEvento": "2026-03-14T09:30:00-03:00",
  "titulo": "Vacinacao contra influenza equina",
  "observacao": "Animal sem reacao adversa ate o fim do atendimento.",
  "detalhe": {
    "procedimento": "vacinacao",
    "produto": "Vacina influenza equina",
    "dose": "1 mL",
    "via": "intramuscular",
    "dataRetorno": "2026-09-14"
  }
}
```

```http
201 Created
Location: /eventos/3f2a7c90-5e41-4b2d-9a77-0c13ef8b4411

{
  "id": "3f2a7c90-5e41-4b2d-9a77-0c13ef8b4411",
  "animalId": "8c1f...",
  "dominio": "saude",
  "dataEvento": "2026-03-14T09:30:00-03:00",
  "registradoPor": { "id": "a71c...", "nome": "V1" },
  "versao": 1,
  "lembreteGerado": { "id": "b0d5...", "dataPrevista": "2026-09-14", "status": "pendente" }
}
```

## 6. Casos de uso de referência

**UC03 Conceder acesso.** Ator: proprietário. Pré: autenticado, proprietário do
animal, convidado já cadastrado. Fluxo: seleciona o animal, aciona acessos,
informa e-mail do convidado, papel e vigência; o sistema valida a existência do
usuário e a ausência de vínculo ativo equivalente; registra e confirma.
Alternativo 4a: usuário não cadastrado, o sistema responde 404 com mensagem
informando a condição e orientando o cadastro prévio do convidado. Não há envio de
mensagem pelo sistema: integração com servidor de e-mail está fora do escopo do
protótipo. Pós: vínculo registrado, acesso conforme a matriz, operação em auditoria.

**UC04 Registrar evento de saúde.** Ator: veterinário. Pré: vínculo vigente de
veterinário sobre o animal. Fluxo: seleciona animal e novo evento de saúde;
informa procedimento, data, produto, dose, via e observação; opcionalmente data de
retorno; o sistema valida obrigatórios, persiste e, havendo data de retorno, gera
o lembrete na mesma transação. Alternativo 4a: sem conectividade, grava na base
local em estado pendente. Pós: evento visível a quem tem leitura do domínio.

**UC08 Consultar linha do tempo.** Ator: todos. Fluxo: seleciona o animal; o
sistema recupera apenas os eventos dos domínios que o papel pode ler; apresenta em
ordem cronológica decrescente com domínio, data e autor; aplica filtros. Regra:
eventos de domínios não autorizados não são apresentados nem contabilizados, e sua
existência não é revelada. Pós: consulta registrada em auditoria.

## 7. Casos de teste

Os resultados são preenchidos pela execução real, nunca antecipados.

| ID | Cenário | Requisito | Esperado |
|---|---|---|---|
| CT01 | Autenticação com credenciais válidas | RF02 | Emissão de access e refresh |
| CT02 | Autenticação com senha incorreta | RF02 | 401 sem indicar o campo errado |
| CT03 | Evento de saúde com data de retorno | RF09, RF17 | Evento e lembrete na mesma transação |
| CT04 | Evento sem campo obrigatório | RNF08 | 422 com mensagem compreensível |
| CT05 | Veterinário tenta registrar competição | RF12, RNF03 | 403 e registro em auditoria |
| CT06 | Manejo consulta linha do tempo | RF13, RNF03 | Eventos de saúde nem retornados nem contados |
| CT07 | Requisição direta sem o cliente oficial | RNF03 | Mesma decisão de autorização |
| CT08 | Acesso após revogação do vínculo | RF07 | Recusa imediata, sem aguardar expiração |
| CT09 | Registro em modo avião | RF21, RNF06 | Gravação local pendente, sem perda |
| CT10 | Reconexão após registro local | RF21, RNF06 | Sincronização em ordem cronológica |
| CT11 | Reenvio de evento já sincronizado | RF21 | Idempotente, sem duplicar |
| CT12 | Linha do tempo com 500 eventos | RNF05 | Resposta em até 2 s |
| CT13 | Edição por quem não é autor | RF15 | 403 |
| CT14 | Exclusão lógica pelo proprietário | RF16 | Some da linha do tempo, permanece na base |
| CT15 | Lembrete marcado como cumprido | RF19 | Estado alterado e notificação cancelada |

## 8. Massa de dados de teste

Estado inicial padronizado de cada sessão de avaliação, em `dados-de-teste/`:
2 animais cadastrados, 30 eventos distribuídos entre os quatro domínios, 3 usuários
de teste representando papéis distintos do papel do participante. A base é
reinicializada antes de cada sessão. Para o CT12, massa adicional de 500 eventos.

---

## 9. Decisões de projeto

Resolvem ambiguidades identificadas antes da implementação. Têm o mesmo peso
normativo do restante deste documento.

**9.1 Quem é proprietário.** `animal.proprietario_id` é a referência de
propriedade. Na criação do animal, a mesma transação grava uma linha em
`vinculo_acesso` com papel `proprietario`, `data_inicio` igual à data corrente e
`data_fim` nula. A autorização resolve sempre por `vinculo_acesso`, sem caso
especial para o dono.

**9.2 Criação de animal.** `POST /animais` não passa pelo middleware `autorizar`,
porque antes da criação não existe animal nem vínculo. Exige apenas usuário
autenticado. O criador torna-se o proprietário.

**9.3 Contrato da sincronização em lote.** `POST /sincronizacao/lote` recebe um
array de eventos, cada um com seu `id` gerado no cliente e sua `versao` conhecida.
Para cada item:

| Situação | Tratamento | Situação devolvida |
|---|---|---|
| `id` inexistente no servidor | cria o evento | `sincronizado` |
| `id` existente, mesma `versao` | não altera nada | `sincronizado` |
| `id` existente, `versao` do servidor maior | não altera nada | `conflito` |
| sem permissão ou vínculo revogado | não altera nada | `recusado` |

A resposta é 200 com um resultado por item, contendo `id`, `situacao` e
`versaoServidor`. Nunca um único status para o lote inteiro. O caso de mesma versão
é o que garante a idempotência exigida pelo CT11.

**9.4 Filtro por domínio não legível.** Se o usuário filtrar a linha do tempo por um
domínio que seu papel não pode ler, a resposta é 200 com lista vazia e total zero.
O filtro nunca é ignorado silenciosamente, porque isso devolveria dado que o
usuário não pediu.

**9.5 Canal cifrado no desenvolvimento.** O Express sobe em HTTPS com certificado
autoassinado gerado por script versionado no repositório, e um listener HTTP em
porta separada responde 426 Upgrade Required a qualquer requisição. Isso torna o
RNF02 verificável em dois comandos. Em produção a terminação TLS ficaria em proxy
reverso, o que não altera o comportamento especificado.

**9.6 Convite de usuário.** O sistema não envia e-mail. O fluxo alternativo do UC03
apenas informa que o convidado não está cadastrado.
