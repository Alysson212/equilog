const { prisma } = require("./prisma");
const { PADRAO_UUID } = require("../dominio/validacao");

const INCLUIR_COMPLETO = {
  tipoEvento: true,
  autor: { select: { id: true, nome: true } },
  saude: true,
  manejo: true,
  treinamento: true,
  competicao: true,
};

function buscarPorId(id, db = prisma) {
  if (!PADRAO_UUID.test(id ?? "")) return null;
  return db.evento.findUnique({ where: { id }, include: INCLUIR_COMPLETO });
}

// Evento nao excluido logicamente
async function buscarAtivo(id, db = prisma) {
  const evento = await buscarPorId(id, db);
  return evento && !evento.excluidoEm ? evento : null;
}

// Grava evento e subtipo juntos (supertipo e subtipo na mesma operacao)
function criar({ comum, relacao, detalhe }, db = prisma) {
  return db.evento.create({
    data: { ...comum, [relacao]: { create: detalhe } },
    include: INCLUIR_COMPLETO,
  });
}

// Atualizacao condicionada a versao lida: devolve 0 se outra edicao venceu
async function atualizarComVersao(id, versaoLida, { comum, relacao, detalhe }, db = prisma) {
  const { count } = await db.evento.updateMany({
    where: { id, versao: versaoLida },
    data: { ...comum, versao: { increment: 1 } },
  });
  if (count === 0) return 0;
  if (detalhe && Object.keys(detalhe).length > 0) {
    await db[modeloDoSubtipo(relacao)].update({ where: { eventoId: id }, data: detalhe });
  }
  return count;
}

function excluirLogicamente(id, db = prisma) {
  return db.evento.update({ where: { id }, data: { excluidoEm: new Date() } });
}

function registrarHistorico(dados, db = prisma) {
  return db.eventoHistorico.create({ data: dados });
}

// Linha do tempo: o filtro por dominios legiveis integra o where (UC08)
async function listarLinhaDoTempo(where, { limite, deslocamento }, db = prisma) {
  const [itens, total] = await Promise.all([
    db.evento.findMany({
      where,
      orderBy: [{ dataEvento: "desc" }, { id: "asc" }],
      take: limite,
      skip: deslocamento,
      include: INCLUIR_COMPLETO,
    }),
    db.evento.count({ where }),
  ]);
  return { itens, total };
}

function idsDoAnimal(animalId, db = prisma) {
  return db.evento.findMany({ where: { animalId }, select: { id: true } });
}

function modeloDoSubtipo(relacao) {
  return {
    saude: "eventoSaude",
    manejo: "eventoManejo",
    treinamento: "eventoTreinamento",
    competicao: "eventoCompeticao",
  }[relacao];
}

module.exports = {
  buscarPorId,
  buscarAtivo,
  criar,
  atualizarComVersao,
  excluirLogicamente,
  registrarHistorico,
  listarLinhaDoTempo,
  idsDoAnimal,
};
