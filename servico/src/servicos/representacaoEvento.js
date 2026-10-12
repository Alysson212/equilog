// Representacao de evento devolvida pela API (exemplo normativo da secao 5),
// com o supertipo, o subtipo e o autor do registro.

const { ESQUEMAS_DOMINIO } = require("../dominio/esquemasEvento");
const { formatarData, formatarDataHora } = require("../dominio/datas");

// Converte o subtipo do banco (Decimal, Date) para JSON simples
function paraDetalhe(evento) {
  const esquema = ESQUEMAS_DOMINIO[evento.tipoEvento.dominio];
  const subtipo = evento[esquema.relacao];
  if (!subtipo) return null;
  const detalhe = {};
  for (const [campo, regra] of Object.entries(esquema.campos)) {
    const valor = subtipo[campo];
    if (valor === null || valor === undefined) detalhe[campo] = null;
    else if (regra.tipo === "decimal") detalhe[campo] = Number(valor);
    else if (regra.tipo === "data") detalhe[campo] = formatarData(valor);
    else detalhe[campo] = valor;
  }
  return detalhe;
}

function paraLembrete(lembrete) {
  if (!lembrete) return null;
  return { id: lembrete.id, dataPrevista: formatarData(lembrete.dataPrevista), status: lembrete.status };
}

function paraItem(evento) {
  return {
    id: evento.id,
    animalId: evento.animalId,
    dominio: evento.tipoEvento.dominio,
    tipoEvento: evento.tipoEvento.nome,
    dataEvento: formatarDataHora(evento.dataEvento),
    titulo: evento.titulo,
    observacao: evento.observacao,
    registradoPor: { id: evento.autor.id, nome: evento.autor.nome },
    versao: evento.versao,
    criadoEm: formatarDataHora(evento.criadoEm),
    atualizadoEm: formatarDataHora(evento.atualizadoEm),
    detalhe: paraDetalhe(evento),
  };
}

// Conteudo integral do evento e do subtipo, gravado em evento_historico (RF15)
function paraHistorico(evento) {
  return {
    ...paraItem(evento),
    tipoEventoId: evento.tipoEventoId,
    excluidoEm: evento.excluidoEm ? formatarDataHora(evento.excluidoEm) : null,
  };
}

module.exports = { paraItem, paraLembrete, paraHistorico };
