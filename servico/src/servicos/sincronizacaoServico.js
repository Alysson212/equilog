// Sincronizacao em lote dos eventos registrados sem conexao (RF21, RNF06;
// especificacao, decisao 9.3). Cada item traz o id gerado no cliente e a versao
// conhecida. A resposta e um resultado por item, nunca um status unico:
//
//   id inexistente no servidor          -> cria o evento   -> sincronizado
//   id existente, mesma versao          -> nao altera nada -> sincronizado
//   id existente, versao do servidor
//   diferente da informada              -> nao altera nada -> conflito
//   sem permissao ou vinculo revogado   -> nao altera nada -> recusado
//
// A autorizacao de cada item e decidida aqui, pela mesma tripla usuario, animal
// e papel vigente do middleware autorizar, porque um lote pode conter eventos
// de animais diferentes.

const eventoRepo = require("../repositorios/eventoRepo");
const { buscarVinculoVigente } = require("../repositorios/vinculoRepo");
const eventoServico = require("./eventoServico");
const auditoria = require("./auditoriaServico");
const { papelPode, DOMINIOS_EVENTO } = require("../dominio/matrizPermissoes");
const { ErroAplicacao, requisicaoMalformada, falhaDeValidacao } = require("../dominio/erros");
const { validarObjeto } = require("../dominio/validacao");

const TAMANHO_MAXIMO_LOTE = 100;

const REGRAS_ENVELOPE = {
  id: { tipo: "uuid", obrigatorio: true, rotulo: "o identificador do registro" },
  animalId: { tipo: "uuid", obrigatorio: true, rotulo: "o animal" },
  versao: { tipo: "inteiro", obrigatorio: true, minimo: 1, rotulo: "a versão" },
  dominio: {
    tipo: "opcao",
    obrigatorio: true,
    valores: DOMINIOS_EVENTO,
    rotulo: "o domínio",
    mensagemOpcao: "Escolha o tipo de registro: saúde, manejo, treinamento ou competição.",
  },
};

function resultado(id, situacao, versaoServidor = null, extras = {}) {
  return { id: id ?? null, situacao, versaoServidor, ...extras };
}

// Toda recusa de item vai para a trilha de auditoria (RNF04), com o motivo.
// Negacao de permissao usa a acao acesso_negado, como o middleware autorizar;
// dados invalidos usam sincronizacao_recusada.
async function recusar(contexto, item, motivo, extras = {}) {
  const id = typeof item?.id === "string" ? item.id : null;
  const animalId = typeof item?.animalId === "string" ? item.animalId : null;
  await auditoria.registrar({
    usuarioId: contexto.usuarioId,
    acao: motivo === "dados_invalidos" ? "sincronizacao_recusada" : "acesso_negado",
    entidade: "sincronizacao",
    entidadeId: animalId ?? id,
    motivo,
    enderecoIp: contexto.enderecoIp,
  });
  return resultado(id, "recusado", null, { motivo, ...extras });
}

async function sincronizarItem(contexto, bruto) {
  if (bruto === null || typeof bruto !== "object" || Array.isArray(bruto)) {
    return recusar(contexto, null, "dados_invalidos");
  }
  const { valores: envelope, erros } = validarObjeto(bruto, REGRAS_ENVELOPE);
  if (erros.length > 0) {
    return recusar(contexto, bruto, "dados_invalidos", { campos: erros });
  }

  const vinculo = await buscarVinculoVigente(contexto.usuarioId, envelope.animalId, new Date());
  if (!vinculo) return recusar(contexto, envelope, "sem_vinculo");
  if (!papelPode(vinculo.papel, "criar", envelope.dominio)) return recusar(contexto, envelope, "papel_insuficiente");

  const existente = await eventoRepo.buscarPorId(envelope.id);
  if (existente) {
    if (existente.animalId !== envelope.animalId || existente.registradoPor !== contexto.usuarioId) {
      return recusar(contexto, envelope, "id_de_outro_registro");
    }
    if (existente.versao === envelope.versao) return resultado(envelope.id, "sincronizado", existente.versao);
    return resultado(envelope.id, "conflito", existente.versao);
  }

  try {
    const { evento } = await eventoServico.registrar(contexto, envelope.animalId, { ...bruto, id: envelope.id });
    return resultado(envelope.id, "sincronizado", evento.versao);
  } catch (erro) {
    if (erro instanceof ErroAplicacao && erro.status === 422) {
      return recusar(contexto, envelope, "dados_invalidos", { campos: erro.campos });
    }
    throw erro;
  }
}

// Itens processados na ordem recebida; o aplicativo envia em ordem cronologica
async function sincronizarLote(contexto, corpo) {
  if (!Array.isArray(corpo)) {
    throw requisicaoMalformada("Envie a lista de registros pendentes.");
  }
  if (corpo.length > TAMANHO_MAXIMO_LOTE) {
    throw falhaDeValidacao([
      { campo: null, mensagem: `Envie no máximo ${TAMANHO_MAXIMO_LOTE} registros por vez.` },
    ]);
  }
  const resultados = [];
  for (const item of corpo) {
    resultados.push(await sincronizarItem(contexto, item));
  }
  return { resultados };
}

module.exports = { sincronizarLote, TAMANHO_MAXIMO_LOTE };
