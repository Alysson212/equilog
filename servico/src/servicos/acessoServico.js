// Concessao e revogacao de vinculo de acesso (RF06, RF07; caso de uso UC03).

const usuarioRepo = require("../repositorios/usuarioRepo");
const vinculoRepo = require("../repositorios/vinculoRepo");
const papelRepo = require("../repositorios/papelRepo");
const { emTransacao } = require("../repositorios/prisma");
const auditoria = require("./auditoriaServico");
const { falhaDeValidacao, naoEncontrado } = require("../dominio/erros");
const { hoje, paraDataSemHora, formatarData } = require("../dominio/datas");
const { validarObjeto, exigirObjeto, lancarSeHouverErros } = require("../dominio/validacao");

// O papel de proprietario nasce com o cadastro do animal e nao e concedido
const PAPEIS_CONCEDIVEIS = ["veterinario", "treinador", "manejo"];

const REGRAS_CONCESSAO = {
  email: { tipo: "email", obrigatorio: true, max: 160, rotulo: "o e-mail do convidado" },
  papel: {
    tipo: "opcao",
    obrigatorio: true,
    valores: PAPEIS_CONCEDIVEIS,
    rotulo: "o papel",
    mensagemOpcao: "Escolha o papel entre veterinário, treinador ou responsável pelo manejo.",
  },
  dataInicio: { tipo: "data", rotulo: "a data de início" },
  dataFim: { tipo: "data", rotulo: "a data de fim" },
};

function paraRepresentacao(vinculo) {
  return {
    id: vinculo.id,
    animalId: vinculo.animalId,
    usuario: { id: vinculo.usuario.id, nome: vinculo.usuario.nome, email: vinculo.usuario.email },
    papel: vinculo.papel.nome,
    dataInicio: formatarData(vinculo.dataInicio),
    dataFim: formatarData(vinculo.dataFim),
    ativo: vinculo.ativo,
  };
}

async function conceder(contexto, animalId, corpo) {
  const { valores, erros } = validarObjeto(exigirObjeto(corpo), REGRAS_CONCESSAO);
  const dataInicio = valores.dataInicio ?? hoje();
  if (valores.dataFim && valores.dataFim < dataInicio) {
    erros.push({ campo: "dataFim", mensagem: "A data de fim não pode ser anterior à data de início." });
  }
  lancarSeHouverErros(erros);

  // UC03, fluxo alternativo 4a (decisao 9.6): sem envio de convite
  const convidado = await usuarioRepo.buscarPorEmail(valores.email);
  if (!convidado || !convidado.ativo) {
    throw naoEncontrado(
      "Não encontramos uma conta com este e-mail. Peça para a pessoa se cadastrar no EquiLog e depois conceda o acesso.",
    );
  }
  if (convidado.id === contexto.usuarioId) {
    throw falhaDeValidacao([{ campo: "email", mensagem: "Você já é o proprietário deste animal." }]);
  }
  // UC03, passo 4: ausencia de vinculo ativo equivalente
  if (await vinculoRepo.buscarAtivoNaoEncerrado(convidado.id, animalId)) {
    throw falhaDeValidacao([
      { campo: "email", mensagem: "Esta pessoa já tem acesso a este animal. Revogue o acesso atual antes de conceder outro." },
    ]);
  }

  const vinculo = await emTransacao(async (tx) => {
    const papel = await papelRepo.buscarPorNome(valores.papel, tx);
    const criado = await vinculoRepo.criar(
      {
        usuarioId: convidado.id,
        animalId,
        papelId: papel.id,
        dataInicio: paraDataSemHora(dataInicio),
        dataFim: valores.dataFim ? paraDataSemHora(valores.dataFim) : null,
        concedidoPor: contexto.usuarioId,
      },
      tx,
    );
    await auditoria.registrar(
      { usuarioId: contexto.usuarioId, acao: "acesso_concedido", entidade: "vinculo_acesso", entidadeId: criado.id, enderecoIp: contexto.enderecoIp },
      tx,
    );
    return criado;
  });
  return paraRepresentacao(vinculo);
}

// RF07: efeito imediato, porque o vinculo e consultado a cada requisicao
async function revogar(contexto, vinculo) {
  if (vinculo.papel.nome === "proprietario") {
    throw falhaDeValidacao([{ campo: null, mensagem: "O acesso do proprietário não pode ser revogado." }]);
  }
  if (!vinculo.ativo) return;

  await emTransacao(async (tx) => {
    await vinculoRepo.desativar(vinculo.id, tx);
    await auditoria.registrar(
      { usuarioId: contexto.usuarioId, acao: "acesso_revogado", entidade: "vinculo_acesso", entidadeId: vinculo.id, enderecoIp: contexto.enderecoIp },
      tx,
    );
  });
}

// Vinculos do animal, para a tela de concessao e revogacao (restrita ao
// proprietario). vigente indica se o vinculo da acesso na data corrente.
async function listar(animalId) {
  const vinculos = await vinculoRepo.listarDoAnimal(animalId);
  const dia = hoje();
  return vinculos.map((vinculo) => {
    const representacao = paraRepresentacao(vinculo);
    representacao.vigente =
      vinculo.ativo && representacao.dataInicio <= dia && (representacao.dataFim === null || representacao.dataFim >= dia);
    return representacao;
  });
}

module.exports = { conceder, revogar, listar };
