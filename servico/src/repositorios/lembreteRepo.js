const { prisma } = require("./prisma");
const { PADRAO_UUID } = require("../dominio/validacao");

// Estados em que o lembrete ainda pode notificar
const ESTADOS_EM_ABERTO = ["pendente", "adiado"];

function criar(dados, db = prisma) {
  return db.lembrete.create({ data: dados });
}

function buscarPorId(id, db = prisma) {
  if (!PADRAO_UUID.test(id ?? "")) return null;
  return db.lembrete.findUnique({
    where: { id },
    include: { animal: { select: { id: true, nome: true } }, evento: { include: { tipoEvento: true } } },
  });
}

function primeiroDoEvento(eventoId, db = prisma) {
  return db.lembrete.findFirst({ where: { eventoId }, orderBy: { dataPrevista: "asc" } });
}

function emAbertoDoEvento(eventoId, db = prisma) {
  return db.lembrete.findMany({ where: { eventoId, status: { in: ESTADOS_EM_ABERTO } } });
}

function atualizar(id, dados, db = prisma) {
  return db.lembrete.update({ where: { id }, data: dados });
}

// Lembretes de eventos nao excluidos dos animais informados
function listarDosAnimais(animalIds, { status }, db = prisma) {
  return db.lembrete.findMany({
    where: {
      animalId: { in: animalIds },
      evento: { excluidoEm: null },
      ...(status ? { status } : {}),
    },
    orderBy: [{ dataPrevista: "asc" }, { id: "asc" }],
    include: { animal: { select: { id: true, nome: true } }, evento: { include: { tipoEvento: true } } },
  });
}

function idsDoAnimal(animalId, db = prisma) {
  return db.lembrete.findMany({ where: { animalId }, select: { id: true } });
}

module.exports = {
  ESTADOS_EM_ABERTO,
  criar,
  buscarPorId,
  primeiroDoEvento,
  emAbertoDoEvento,
  atualizar,
  listarDosAnimais,
  idsDoAnimal,
};
