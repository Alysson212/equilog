const { prisma } = require("./prisma");

function buscarPorDominioENome(dominio, nome, db = prisma) {
  return db.tipoEvento.findFirst({ where: { dominio, nome } });
}

function listarTodos(db = prisma) {
  return db.tipoEvento.findMany({ orderBy: [{ dominio: "asc" }, { id: "asc" }] });
}

module.exports = { buscarPorDominioENome, listarTodos };
