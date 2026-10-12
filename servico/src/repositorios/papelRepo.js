const { prisma } = require("./prisma");

function buscarPorNome(nome, db = prisma) {
  return db.papel.findUnique({ where: { nome } });
}

module.exports = { buscarPorNome };
