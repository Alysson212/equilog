// Linha do tempo do animal (RF13, RF14; caso de uso UC08; Trecho de codigo 4).
// O filtro pelos dominios que o papel pode ler integra a consulta ao banco,
// antes de qualquer filtro do usuario: eventos de dominios nao autorizados nao
// sao recuperados nem contados, e sua existencia nao e revelada.

const eventoRepo = require("../repositorios/eventoRepo");
const auditoria = require("./auditoriaServico");
const { paraItem } = require("./representacaoEvento");
const { dominiosLegiveis, DOMINIOS_EVENTO } = require("../dominio/matrizPermissoes");
const { limitesDoDia } = require("../dominio/datas");
const { validarCampo, lancarSeHouverErros } = require("../dominio/validacao");
const { lerPaginacao } = require("../dominio/paginacao");

// Valida os filtros da consulta (query string)
function lerFiltros(consulta) {
  const erros = [];
  const filtros = lerPaginacao(consulta, erros);

  if (consulta.dominio !== undefined) {
    if (!DOMINIOS_EVENTO.includes(consulta.dominio)) {
      erros.push({ campo: "dominio", mensagem: "Filtre por saúde, manejo, treinamento ou competição." });
    } else {
      filtros.dominio = consulta.dominio;
    }
  }

  for (const [campo, rotulo, limite] of [
    ["de", "a data inicial", "inicio"],
    ["ate", "a data final", "fim"],
  ]) {
    if (consulta[campo] === undefined) continue;
    const texto = String(consulta[campo]);
    if (texto.length === 10) {
      const resultado = validarCampo(texto, { tipo: "data", rotulo });
      if (resultado.mensagem) erros.push({ campo, mensagem: resultado.mensagem });
      else filtros[campo] = limitesDoDia(resultado.valor)[limite];
    } else {
      const resultado = validarCampo(texto, { tipo: "dataHora", rotulo });
      if (resultado.mensagem) erros.push({ campo, mensagem: resultado.mensagem });
      else filtros[campo] = resultado.valor;
    }
  }
  if (filtros.de && filtros.ate && filtros.de > filtros.ate) {
    erros.push({ campo: "ate", mensagem: "A data final não pode ser anterior à data inicial." });
  }

  if (consulta.autorId !== undefined) {
    const resultado = validarCampo(consulta.autorId, { tipo: "uuid", rotulo: "o autor" });
    if (resultado.mensagem) erros.push({ campo: "autorId", mensagem: resultado.mensagem });
    else filtros.autorId = resultado.valor;
  }

  lancarSeHouverErros(erros);
  return filtros;
}

async function consultarLinhaDoTempo(contexto, vinculo, animalId, consulta) {
  const filtros = lerFiltros(consulta);

  await auditoria.registrar({
    usuarioId: contexto.usuarioId,
    acao: "linha_do_tempo_consultada",
    entidade: "animal",
    entidadeId: animalId,
    enderecoIp: contexto.enderecoIp,
  });

  const vazia = { itens: [], total: 0, limite: filtros.limite, deslocamento: filtros.deslocamento };

  // 1. dominios que o papel do usuario pode LER (Quadro 8)
  const dominios = dominiosLegiveis(vinculo.papel);
  if (dominios.length === 0) return vazia;

  // Decisao 9.4: filtro por dominio nao legivel devolve lista vazia,
  // nunca e ignorado silenciosamente
  if (filtros.dominio && !dominios.includes(filtros.dominio)) return vazia;

  // 2. filtros do usuario aplicados SOBRE o conjunto ja restrito
  const where = {
    animalId,
    excluidoEm: null,
    tipoEvento: { dominio: { in: filtros.dominio ? [filtros.dominio] : dominios } },
  };
  if (filtros.de || filtros.ate) {
    where.dataEvento = {};
    if (filtros.de) where.dataEvento.gte = filtros.de;
    if (filtros.ate) where.dataEvento.lte = filtros.ate;
  }
  if (filtros.autorId) where.registradoPor = filtros.autorId;

  const { itens, total } = await eventoRepo.listarLinhaDoTempo(where, filtros);
  return { itens: itens.map(paraItem), total, limite: filtros.limite, deslocamento: filtros.deslocamento };
}

module.exports = { consultarLinhaDoTempo };
