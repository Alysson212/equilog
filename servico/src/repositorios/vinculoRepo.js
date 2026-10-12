const { prisma } = require("./prisma");
const { hoje, paraDataSemHora } = require("../dominio/datas");
const { PADRAO_UUID } = require("../dominio/validacao");

// Condicao de vigencia na data informada: ativo, ja iniciado e nao encerrado.
function condicaoVigente(dia) {
  return {
    ativo: true,
    dataInicio: { lte: dia },
    OR: [{ dataFim: null }, { dataFim: { gte: dia } }],
  };
}

// Resolve a tripla usuario + animal + papel vigente na data (especificacao,
// secao 10, regras 3 e 4). Consultado a cada requisicao: o token nao carrega papeis.
async function buscarVinculoVigente(usuarioId, animalId, data = new Date(), db = prisma) {
  if (!usuarioId || !animalId || !PADRAO_UUID.test(animalId)) return null;
  const dia = paraDataSemHora(hoje(data));
  const vinculo = await db.vinculoAcesso.findFirst({
    where: { usuarioId, animalId, ...condicaoVigente(dia) },
    include: { papel: true },
    orderBy: { dataInicio: "desc" },
  });
  if (!vinculo) return null;
  return {
    id: vinculo.id,
    usuarioId: vinculo.usuarioId,
    animalId: vinculo.animalId,
    papel: vinculo.papel.nome,
    dataInicio: vinculo.dataInicio,
    dataFim: vinculo.dataFim,
  };
}

// Vinculos vigentes do usuario, com o animal, para a listagem de animais (RF08)
function listarVigentesDoUsuario(usuarioId, db = prisma) {
  const dia = paraDataSemHora(hoje());
  return db.vinculoAcesso.findMany({
    where: { usuarioId, ...condicaoVigente(dia) },
    include: { animal: true, papel: true },
    orderBy: { animal: { nome: "asc" } },
  });
}

// Vinculo ativo que ainda nao terminou (vigente ou com inicio futuro)
function buscarAtivoNaoEncerrado(usuarioId, animalId, db = prisma) {
  const dia = paraDataSemHora(hoje());
  return db.vinculoAcesso.findFirst({
    where: { usuarioId, animalId, ativo: true, OR: [{ dataFim: null }, { dataFim: { gte: dia } }] },
  });
}

function buscarPorId(id, db = prisma) {
  if (!PADRAO_UUID.test(id ?? "")) return null;
  return db.vinculoAcesso.findUnique({ where: { id }, include: { papel: true, usuario: true } });
}

function criar(dados, db = prisma) {
  return db.vinculoAcesso.create({ data: dados, include: { papel: true, usuario: true } });
}

function desativar(id, db = prisma) {
  return db.vinculoAcesso.update({ where: { id }, data: { ativo: false } });
}

function idsDoAnimal(animalId, db = prisma) {
  return db.vinculoAcesso.findMany({ where: { animalId }, select: { id: true } });
}

module.exports = {
  buscarVinculoVigente,
  listarVigentesDoUsuario,
  buscarAtivoNaoEncerrado,
  buscarPorId,
  criar,
  desativar,
  idsDoAnimal,
};
