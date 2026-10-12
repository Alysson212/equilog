const { prisma } = require("./prisma");

function buscarPorEmail(email, db = prisma) {
  return db.usuario.findUnique({ where: { email } });
}

function buscarPorId(id, db = prisma) {
  return db.usuario.findUnique({ where: { id } });
}

function criar(dados, db = prisma) {
  return db.usuario.create({ data: dados });
}

module.exports = { buscarPorEmail, buscarPorId, criar };
