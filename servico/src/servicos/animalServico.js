// Cadastro, consulta, edicao e listagem de animais (RF04, RF05, RF08).

const animalRepo = require("../repositorios/animalRepo");
const vinculoRepo = require("../repositorios/vinculoRepo");
const papelRepo = require("../repositorios/papelRepo");
const { emTransacao } = require("../repositorios/prisma");
const auditoria = require("./auditoriaServico");
const { falhaDeValidacao, naoEncontrado } = require("../dominio/erros");
const { hoje, hojeComoData, paraDataSemHora, formatarData } = require("../dominio/datas");
const { validarObjeto, exigirObjeto, lancarSeHouverErros } = require("../dominio/validacao");

const REGRAS_ANIMAL = {
  nome: { tipo: "texto", obrigatorio: true, max: 120, rotulo: "o nome" },
  registroAssociacao: { tipo: "texto", max: 40, rotulo: "o registro na associação" },
  dataNascimento: { tipo: "data", rotulo: "a data de nascimento" },
  sexo: {
    tipo: "opcao",
    obrigatorio: true,
    valores: ["M", "F", "C"],
    rotulo: "o sexo",
    mensagemOpcao: "O sexo deve ser M (macho), F (fêmea) ou C (macho castrado).",
  },
  pelagem: { tipo: "texto", max: 60, rotulo: "a pelagem" },
};

const REGRAS_EDICAO = {
  ...REGRAS_ANIMAL,
  ativo: { tipo: "booleano", obrigatorio: true, rotulo: "a situação do cadastro" },
};

function paraRepresentacao(animal, papel) {
  return {
    id: animal.id,
    nome: animal.nome,
    registroAssociacao: animal.registroAssociacao,
    dataNascimento: formatarData(animal.dataNascimento),
    sexo: animal.sexo,
    pelagem: animal.pelagem,
    ativo: animal.ativo,
    ...(papel ? { papel } : {}),
  };
}

function validarNascimento(valores, erros) {
  if (valores.dataNascimento && valores.dataNascimento > hoje()) {
    erros.push({ campo: "dataNascimento", mensagem: "A data de nascimento não pode estar no futuro." });
  }
}

function paraDados(valores) {
  const dados = { ...valores };
  if ("dataNascimento" in dados) {
    dados.dataNascimento = dados.dataNascimento ? paraDataSemHora(dados.dataNascimento) : null;
  }
  return dados;
}

async function listar(usuarioId) {
  const vinculos = await vinculoRepo.listarVigentesDoUsuario(usuarioId);
  return vinculos.map((v) => paraRepresentacao(v.animal, v.papel.nome));
}

// Decisoes 9.1 e 9.2: quem cria e o proprietario, e a mesma transacao grava o
// vinculo de proprietario com vigencia aberta.
async function cadastrar(contexto, corpo) {
  const { valores, erros } = validarObjeto(exigirObjeto(corpo), REGRAS_ANIMAL);
  validarNascimento(valores, erros);
  lancarSeHouverErros(erros);

  const animal = await emTransacao(async (tx) => {
    const papelProprietario = await papelRepo.buscarPorNome("proprietario", tx);
    const criado = await animalRepo.criar({ ...paraDados(valores), proprietarioId: contexto.usuarioId }, tx);
    await vinculoRepo.criar(
      {
        usuarioId: contexto.usuarioId,
        animalId: criado.id,
        papelId: papelProprietario.id,
        dataInicio: hojeComoData(),
        dataFim: null,
        concedidoPor: contexto.usuarioId,
      },
      tx,
    );
    await auditoria.registrar(
      { usuarioId: contexto.usuarioId, acao: "animal_criado", entidade: "animal", entidadeId: criado.id, enderecoIp: contexto.enderecoIp },
      tx,
    );
    return criado;
  });
  return paraRepresentacao(animal, "proprietario");
}

async function consultar(vinculo) {
  const animal = await animalRepo.buscarPorId(vinculo.animalId);
  if (!animal) throw naoEncontrado();
  return paraRepresentacao(animal, vinculo.papel);
}

// RF05: edicao e inativacao (ativo = false) pelo proprietario
async function editar(contexto, vinculo, corpo) {
  const dados = exigirObjeto(corpo);
  const { valores, erros } = validarObjeto(dados, REGRAS_EDICAO, { parcial: true });
  validarNascimento(valores, erros);
  lancarSeHouverErros(erros);
  if (Object.keys(valores).length === 0) {
    throw falhaDeValidacao([{ campo: null, mensagem: "Informe ao menos um dado do animal para alterar." }]);
  }

  const animal = await emTransacao(async (tx) => {
    const atualizado = await animalRepo.atualizar(vinculo.animalId, paraDados(valores), tx);
    await auditoria.registrar(
      { usuarioId: contexto.usuarioId, acao: "animal_editado", entidade: "animal", entidadeId: vinculo.animalId, enderecoIp: contexto.enderecoIp },
      tx,
    );
    return atualizado;
  });
  return paraRepresentacao(animal, vinculo.papel);
}

module.exports = { listar, cadastrar, consultar, editar };
