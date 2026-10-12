// Registro (RF09 a RF12), edicao (RF15) e exclusao logica (RF16) de eventos.
// Supertipo e subtipo sao gravados na mesma transacao. O identificador vem do
// cliente (RF21, RNF06). O lembrete nasce apenas da data de retorno digitada
// por uma pessoa, na mesma transacao do evento (RF17): nada e calculado (RNF11).

const eventoRepo = require("../repositorios/eventoRepo");
const tipoEventoRepo = require("../repositorios/tipoEventoRepo");
const lembreteRepo = require("../repositorios/lembreteRepo");
const { emTransacao, violouUnicidade } = require("../repositorios/prisma");
const auditoria = require("./auditoriaServico");
const { paraItem, paraLembrete, paraHistorico } = require("./representacaoEvento");
const { CAMPOS_COMUNS, ESQUEMAS_DOMINIO } = require("../dominio/esquemasEvento");
const { falhaDeValidacao, semPermissao, conflitoDeVersao } = require("../dominio/erros");
const { paraDataSemHora } = require("../dominio/datas");
const { validarObjeto, validarCampo, exigirObjeto, lancarSeHouverErros } = require("../dominio/validacao");

const ID_EM_USO = { campo: "id", mensagem: "Este identificador de registro já está em uso." };

function validarDetalhe(dominio, detalhe, erros, { parcial = false } = {}) {
  if (detalhe === undefined && parcial) return {};
  if (detalhe === null || typeof detalhe !== "object" || Array.isArray(detalhe)) {
    erros.push({ campo: "detalhe", mensagem: "Informe os dados específicos do registro." });
    return {};
  }
  const resultado = validarObjeto(detalhe, ESQUEMAS_DOMINIO[dominio].campos, { parcial, prefixo: "detalhe" });
  erros.push(...resultado.erros);
  return resultado.valores;
}

// Converte o detalhe validado para os tipos de coluna do subtipo
function paraDadosDoSubtipo(dominio, valores) {
  const dados = { ...valores };
  if (dominio === "saude" && "dataRetorno" in dados) {
    dados.dataRetorno = dados.dataRetorno ? paraDataSemHora(dados.dataRetorno) : null;
  }
  return dados;
}

async function buscarTipo(dominio, nome) {
  const tipo = await tipoEventoRepo.buscarPorDominioENome(dominio, nome);
  if (!tipo) {
    throw falhaDeValidacao([{ campo: "tipoEvento", mensagem: "Escolha um tipo de registro da lista." }]);
  }
  return tipo;
}

// Reenvio do mesmo evento pelo mesmo autor: devolve o que ja existe, sem duplicar
async function resolverExistente(existente, contexto, animalId) {
  if (existente.animalId !== animalId || existente.registradoPor !== contexto.usuarioId) {
    throw falhaDeValidacao([ID_EM_USO]);
  }
  const lembrete = await lembreteRepo.primeiroDoEvento(existente.id);
  return { evento: { ...paraItem(existente), lembreteGerado: paraLembrete(lembrete) }, criado: false };
}

async function registrar(contexto, animalId, corpo) {
  const dados = exigirObjeto(corpo);
  const { dominio } = dados;
  const { valores, erros } = validarObjeto(dados, CAMPOS_COMUNS);
  const detalhe = validarDetalhe(dominio, dados.detalhe, erros);
  lancarSeHouverErros(erros);

  const tipo = await buscarTipo(dominio, valores.tipoEvento);

  const existente = await eventoRepo.buscarPorId(valores.id);
  if (existente) return resolverExistente(existente, contexto, animalId);

  try {
    return await emTransacao(async (tx) => {
      const evento = await eventoRepo.criar(
        {
          comum: {
            id: valores.id,
            animalId,
            tipoEventoId: tipo.id,
            dataEvento: valores.dataEvento,
            titulo: valores.titulo,
            observacao: valores.observacao,
            registradoPor: contexto.usuarioId,
          },
          relacao: ESQUEMAS_DOMINIO[dominio].relacao,
          detalhe: paraDadosDoSubtipo(dominio, detalhe),
        },
        tx,
      );

      let lembrete = null;
      if (dominio === "saude" && detalhe.dataRetorno) {
        lembrete = await lembreteRepo.criar(
          {
            eventoId: evento.id,
            animalId,
            dataPrevista: paraDataSemHora(detalhe.dataRetorno),
            status: "pendente",
            criadoPor: contexto.usuarioId,
          },
          tx,
        );
      }

      await auditoria.registrar(
        { usuarioId: contexto.usuarioId, acao: "evento_criado", entidade: "evento", entidadeId: evento.id, enderecoIp: contexto.enderecoIp },
        tx,
      );
      if (lembrete) {
        await auditoria.registrar(
          { usuarioId: contexto.usuarioId, acao: "lembrete_criado", entidade: "lembrete", entidadeId: lembrete.id, enderecoIp: contexto.enderecoIp },
          tx,
        );
      }

      return { evento: { ...paraItem(evento), lembreteGerado: paraLembrete(lembrete) }, criado: true };
    });
  } catch (erro) {
    // dois envios simultaneos do mesmo id: o segundo encontra o primeiro gravado
    if (violouUnicidade(erro)) {
      const gravado = await eventoRepo.buscarPorId(valores.id);
      if (gravado) return resolverExistente(gravado, contexto, animalId);
    }
    throw erro;
  }
}

// Mantem o lembrete coerente com a data de retorno editada pela pessoa:
// atualiza o lembrete em aberto, cria um se nao houver, cancela se a data sumir.
async function ajustarLembretes(evento, dataRetorno, contexto, tx) {
  const emAberto = await lembreteRepo.emAbertoDoEvento(evento.id, tx);
  if (!dataRetorno) {
    for (const lembrete of emAberto) {
      await lembreteRepo.atualizar(lembrete.id, { status: "cancelado" }, tx);
      await auditoria.registrar(
        { usuarioId: contexto.usuarioId, acao: "lembrete_cancelado", entidade: "lembrete", entidadeId: lembrete.id, enderecoIp: contexto.enderecoIp },
        tx,
      );
    }
    return;
  }
  const dataPrevista = paraDataSemHora(dataRetorno);
  if (emAberto.length > 0) {
    for (const lembrete of emAberto) {
      await lembreteRepo.atualizar(lembrete.id, { dataPrevista, status: "pendente" }, tx);
      await auditoria.registrar(
        { usuarioId: contexto.usuarioId, acao: "lembrete_atualizado", entidade: "lembrete", entidadeId: lembrete.id, enderecoIp: contexto.enderecoIp },
        tx,
      );
    }
    return;
  }
  const criado = await lembreteRepo.criar(
    { eventoId: evento.id, animalId: evento.animalId, dataPrevista, status: "pendente", criadoPor: contexto.usuarioId },
    tx,
  );
  await auditoria.registrar(
    { usuarioId: contexto.usuarioId, acao: "lembrete_criado", entidade: "lembrete", entidadeId: criado.id, enderecoIp: contexto.enderecoIp },
    tx,
  );
}

const CAMPOS_EDITAVEIS = {
  tipoEvento: CAMPOS_COMUNS.tipoEvento,
  dataEvento: CAMPOS_COMUNS.dataEvento,
  titulo: CAMPOS_COMUNS.titulo,
  observacao: CAMPOS_COMUNS.observacao,
};

async function negar(contexto, evento, motivo, mensagem) {
  await auditoria.registrar({
    usuarioId: contexto.usuarioId,
    acao: "acesso_negado",
    entidade: "evento",
    entidadeId: evento.id,
    motivo,
    enderecoIp: contexto.enderecoIp,
  });
  return semPermissao(mensagem);
}

// RF15: apenas o autor edita; o estado anterior vai para evento_historico e a
// versao e incrementada na mesma transacao.
async function editar(contexto, evento, corpo) {
  if (evento.registradoPor !== contexto.usuarioId) {
    throw await negar(contexto, evento, "nao_autor", "Somente quem registrou pode alterar este registro.");
  }

  const dados = exigirObjeto(corpo);
  const dominio = evento.tipoEvento.dominio;
  const erros = [];
  if (dados.dominio !== undefined && dados.dominio !== dominio) {
    erros.push({ campo: "dominio", mensagem: "O tipo de registro (saúde, manejo, treinamento ou competição) não pode ser alterado." });
  }
  let versaoInformada = null;
  if (dados.versao !== undefined) {
    const resultado = validarCampo(dados.versao, { tipo: "inteiro", minimo: 1, rotulo: "a versão" });
    if (resultado.mensagem) erros.push({ campo: "versao", mensagem: resultado.mensagem });
    else versaoInformada = resultado.valor;
  }
  const comum = validarObjeto(dados, CAMPOS_EDITAVEIS, { parcial: true });
  erros.push(...comum.erros);
  const detalhe = validarDetalhe(dominio, dados.detalhe, erros, { parcial: true });
  lancarSeHouverErros(erros);

  if (Object.keys(comum.valores).length === 0 && Object.keys(detalhe).length === 0) {
    throw falhaDeValidacao([{ campo: null, mensagem: "Informe ao menos um dado do registro para alterar." }]);
  }
  if (versaoInformada !== null && versaoInformada !== evento.versao) throw conflitoDeVersao();

  const alteracoesComuns = { ...comum.valores, atualizadoEm: new Date() };
  if (comum.valores.tipoEvento) {
    const tipo = await buscarTipo(dominio, comum.valores.tipoEvento);
    delete alteracoesComuns.tipoEvento;
    alteracoesComuns.tipoEventoId = tipo.id;
  }

  await emTransacao(async (tx) => {
    await eventoRepo.registrarHistorico(
      {
        eventoId: evento.id,
        versaoAnterior: evento.versao,
        conteudoAnterior: paraHistorico(evento),
        alteradoPor: contexto.usuarioId,
      },
      tx,
    );
    const atualizados = await eventoRepo.atualizarComVersao(
      evento.id,
      evento.versao,
      { comum: alteracoesComuns, relacao: ESQUEMAS_DOMINIO[dominio].relacao, detalhe: paraDadosDoSubtipo(dominio, detalhe) },
      tx,
    );
    if (atualizados === 0) throw conflitoDeVersao();

    if (dominio === "saude" && "dataRetorno" in detalhe) {
      await ajustarLembretes(evento, detalhe.dataRetorno, contexto, tx);
    }
    await auditoria.registrar(
      { usuarioId: contexto.usuarioId, acao: "evento_editado", entidade: "evento", entidadeId: evento.id, enderecoIp: contexto.enderecoIp },
      tx,
    );
  });

  return paraItem(await eventoRepo.buscarPorId(evento.id));
}

// RF16: exclusao logica pelo autor ou pelo proprietario. O registro permanece
// na base; lembretes em aberto do evento deixam de notificar.
async function excluir(contexto, vinculo, evento) {
  if (vinculo.papel !== "proprietario" && evento.registradoPor !== contexto.usuarioId) {
    throw await negar(
      contexto,
      evento,
      "nao_autor_nem_proprietario",
      "Somente quem registrou ou o proprietário do animal pode excluir este registro.",
    );
  }

  await emTransacao(async (tx) => {
    await eventoRepo.excluirLogicamente(evento.id, tx);
    await ajustarLembretes(evento, null, contexto, tx);
    await auditoria.registrar(
      { usuarioId: contexto.usuarioId, acao: "evento_excluido", entidade: "evento", entidadeId: evento.id, enderecoIp: contexto.enderecoIp },
      tx,
    );
  });
}

module.exports = { registrar, editar, excluir };
