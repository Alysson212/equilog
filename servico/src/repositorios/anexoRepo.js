const { prisma } = require("./prisma");
const { PADRAO_UUID } = require("../dominio/validacao");

function criar(dados, db = prisma) {
  return db.anexo.create({ data: dados });
}

function buscarPorId(id, db = prisma) {
  if (!PADRAO_UUID.test(id ?? "")) return null;
  return db.anexo.findUnique({ where: { id }, include: { evento: { include: { tipoEvento: true } } } });
}

function idsDoAnimal(animalId, db = prisma) {
  return db.anexo.findMany({ where: { evento: { animalId } }, select: { id: true } });
}

module.exports = { criar, buscarPorId, idsDoAnimal };
