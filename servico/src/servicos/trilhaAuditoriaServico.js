// Consulta da trilha de auditoria do animal pelo proprietario (RF23).
// Reune os registros cujo entidade_id e o proprio animal (cadastro, consultas e
// negacoes de acesso) ou um evento, vinculo, lembrete ou anexo do animal.
// Endereco IP e e-mail digitado em tentativa de login sao dados pessoais de
// terceiros e nao sao expostos (RNF12).

const auditoriaRepo = require("../repositorios/auditoriaRepo");
const eventoRepo = require("../repositorios/eventoRepo");
const vinculoRepo = require("../repositorios/vinculoRepo");
const lembreteRepo = require("../repositorios/lembreteRepo");
const anexoRepo = require("../repositorios/anexoRepo");
const { formatarDataHora } = require("../dominio/datas");
const { lerPaginacao } = require("../dominio/paginacao");
const { lancarSeHouverErros } = require("../dominio/validacao");

function paraRepresentacao(registro) {
  return {
    id: registro.id.toString(),
    dataHora: formatarDataHora(registro.dataHora),
    usuario: registro.usuario ? { id: registro.usuario.id, nome: registro.usuario.nome } : null,
    acao: registro.acao,
    entidade: registro.entidade,
    entidadeId: registro.entidadeId,
    motivo: registro.motivo,
  };
}

async function consultarDoAnimal(animalId, consulta) {
  const erros = [];
  const paginacao = lerPaginacao(consulta, erros);
  lancarSeHouverErros(erros);

  const grupos = await Promise.all([
    eventoRepo.idsDoAnimal(animalId),
    vinculoRepo.idsDoAnimal(animalId),
    lembreteRepo.idsDoAnimal(animalId),
    anexoRepo.idsDoAnimal(animalId),
  ]);
  const ids = [animalId, ...grupos.flat().map((r) => r.id)];

  const { itens, total } = await auditoriaRepo.listarPorEntidades(ids, paginacao);
  return { itens: itens.map(paraRepresentacao), total, ...paginacao };
}

module.exports = { consultarDoAnimal };
