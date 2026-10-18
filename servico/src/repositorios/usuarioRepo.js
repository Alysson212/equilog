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

// Troca senha e codigo de recuperacao somente se o codigo gravado ainda for o
// conferido: duas recuperacoes simultaneas com o mesmo codigo nao passam ambas.
// Devolve true quando a troca ocorreu.
async function trocarCredenciais(id, codigoConferido, dados, db = prisma) {
  const { count } = await db.usuario.updateMany({ where: { id, codigoRecuperacaoHash: codigoConferido }, data: dados });
  return count === 1;
}

module.exports = { buscarPorEmail, buscarPorId, criar, trocarCredenciais };
