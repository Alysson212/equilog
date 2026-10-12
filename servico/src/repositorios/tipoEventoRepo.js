const { prisma } = require("./prisma");

function buscarPorDominioENome(dominio, nome, db = prisma) {
  return db.tipoEvento.findFirst({ where: { dominio, nome } });
}

module.exports = { buscarPorDominioENome };
