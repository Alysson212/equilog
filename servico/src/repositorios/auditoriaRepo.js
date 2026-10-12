const { prisma } = require("./prisma");

function criar(dados, db = prisma) {
  return db.logAuditoria.create({ data: dados });
}

// Registros cujo entidade_id pertence ao conjunto informado, mais recentes primeiro
async function listarPorEntidades(idsEntidade, { limite, deslocamento }, db = prisma) {
  const where = { entidadeId: { in: idsEntidade } };
  const [itens, total] = await Promise.all([
    db.logAuditoria.findMany({
      where,
      orderBy: [{ dataHora: "desc" }, { id: "desc" }],
      take: limite,
      skip: deslocamento,
      include: { usuario: { select: { id: true, nome: true } } },
    }),
    db.logAuditoria.count({ where }),
  ]);
  return { itens, total };
}

module.exports = { criar, listarPorEntidades };
