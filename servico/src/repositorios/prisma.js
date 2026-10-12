// Instancia unica do cliente Prisma. Os servicos nao importam este modulo:
// usam as funcoes dos repositorios, que recebem opcionalmente o cliente de uma
// transacao aberta por emTransacao.

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function emTransacao(funcao) {
  return prisma.$transaction(funcao);
}

// Codigo do Prisma para violacao de unicidade
function violouUnicidade(erro) {
  return erro?.code === "P2002";
}

module.exports = { prisma, emTransacao, violouUnicidade };
