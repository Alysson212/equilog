const { prisma } = require("./prisma");

function criar(dados, db = prisma) {
  return db.anexo.create({ data: dados });
}

function idsDoAnimal(animalId, db = prisma) {
  return db.anexo.findMany({ where: { evento: { animalId } }, select: { id: true } });
}

module.exports = { criar, idsDoAnimal };
