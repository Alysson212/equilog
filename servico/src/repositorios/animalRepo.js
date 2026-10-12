const { prisma } = require("./prisma");

function buscarPorId(id, db = prisma) {
  return db.animal.findUnique({ where: { id } });
}

function criar(dados, db = prisma) {
  return db.animal.create({ data: dados });
}

function atualizar(id, dados, db = prisma) {
  return db.animal.update({ where: { id }, data: dados });
}

module.exports = { buscarPorId, criar, atualizar };
