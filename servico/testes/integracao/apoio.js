// Apoio aos testes de integracao: requisicoes ao app, criacao de usuarios,
// animais e vinculos pela propria API, e consulta da trilha de auditoria.

const { randomUUID } = require("node:crypto");
const request = require("supertest");
const { app } = require("../../src/app");
const { prisma } = require("../../src/repositorios/prisma");

const SENHA_PADRAO = "senha-segura-123";
let sequencia = 0;

// Apaga os dados de uso, preservando a carga do seed
async function limparBase() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE log_auditoria, anexo, lembrete, evento_historico, evento_saude,
             evento_manejo, evento_treinamento, evento_competicao, evento,
             vinculo_acesso, animal, usuario
    RESTART IDENTITY CASCADE`);
}

function api(token) {
  const comToken = (requisicao) => (token ? requisicao.set("Authorization", `Bearer ${token}`) : requisicao);
  return {
    get: (url) => comToken(request(app).get(url)),
    post: (url) => comToken(request(app).post(url)),
    patch: (url) => comToken(request(app).patch(url)),
    delete: (url) => comToken(request(app).delete(url)),
  };
}

async function criarUsuario(nome) {
  sequencia += 1;
  const email = `${nome.toLowerCase()}.${sequencia}@teste.equilog`;
  const cadastro = await api().post("/usuarios").send({ nome, email, senha: SENHA_PADRAO });
  if (cadastro.status !== 201) throw new Error(`cadastro falhou: ${JSON.stringify(cadastro.body)}`);
  const login = await api().post("/auth/login").send({ email, senha: SENHA_PADRAO });
  return {
    id: cadastro.body.id,
    nome,
    email,
    senha: SENHA_PADRAO,
    token: login.body.tokenAcesso,
    tokenRenovacao: login.body.tokenRenovacao,
  };
}

async function criarAnimal(dono, dados = {}) {
  const resposta = await api(dono.token)
    .post("/animais")
    .send({ nome: "Estrela", sexo: "F", ...dados });
  if (resposta.status !== 201) throw new Error(`animal falhou: ${JSON.stringify(resposta.body)}`);
  return resposta.body;
}

async function conceder(dono, animalId, convidado, papel, extra = {}) {
  const resposta = await api(dono.token)
    .post(`/animais/${animalId}/acessos`)
    .send({ email: convidado.email, papel, ...extra });
  if (resposta.status !== 201) throw new Error(`concessao falhou: ${JSON.stringify(resposta.body)}`);
  return resposta.body;
}

// Cenario padrao: proprietario, animal e um usuario por papel com vinculo vigente
async function montarCenario() {
  const proprietario = await criarUsuario("Proprietario");
  const veterinario = await criarUsuario("Veterinario");
  const treinador = await criarUsuario("Treinador");
  const manejo = await criarUsuario("Manejo");
  const animal = await criarAnimal(proprietario);
  await conceder(proprietario, animal.id, veterinario, "veterinario");
  await conceder(proprietario, animal.id, treinador, "treinador");
  await conceder(proprietario, animal.id, manejo, "manejo");
  return { proprietario, veterinario, treinador, manejo, animal };
}

// Corpo valido de evento por dominio, com id gerado "no cliente"
const MODELOS_EVENTO = {
  saude: { tipoEvento: "vacinacao", titulo: "Vacinacao", detalhe: { procedimento: "vacinacao" } },
  manejo: { tipoEvento: "casqueamento", titulo: "Casqueamento", detalhe: { categoria: "casco" } },
  treinamento: { tipoEvento: "trabalho de tambor", titulo: "Treino", detalhe: { tipoExercicio: "tambor" } },
  competicao: { tipoEvento: "prova oficial", titulo: "Prova", detalhe: { nomeProva: "Copa Regional" } },
};

function novoEvento(dominio, extra = {}) {
  const modelo = MODELOS_EVENTO[dominio];
  return {
    id: randomUUID(),
    dominio,
    dataEvento: "2026-03-14T09:30:00-03:00",
    ...modelo,
    ...extra,
    detalhe: { ...modelo.detalhe, ...(extra.detalhe ?? {}) },
  };
}

async function registrarEvento(usuario, animalId, corpo) {
  const resposta = await api(usuario.token).post(`/animais/${animalId}/eventos`).send(corpo);
  if (resposta.status !== 201) throw new Error(`evento falhou: ${resposta.status} ${JSON.stringify(resposta.body)}`);
  return resposta.body;
}

function registrosDeAuditoria(filtro) {
  return prisma.logAuditoria.findMany({ where: filtro, orderBy: { id: "asc" } });
}

function decodificarToken(token) {
  return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
}

async function encerrar() {
  await prisma.$disconnect();
}

module.exports = {
  api,
  prisma,
  limparBase,
  criarUsuario,
  criarAnimal,
  conceder,
  montarCenario,
  novoEvento,
  registrarEvento,
  registrosDeAuditoria,
  decodificarToken,
  encerrar,
  SENHA_PADRAO,
};
