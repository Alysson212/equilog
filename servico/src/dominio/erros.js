// Erros de aplicacao com codigo de estado HTTP (especificacao, secao 5).
// A mensagem e dirigida ao usuario: linguagem comum, sem detalhe interno (RNF08).

class ErroAplicacao extends Error {
  constructor(status, mensagem, campos) {
    super(mensagem);
    this.status = status;
    this.campos = campos;
  }
}

const requisicaoMalformada = (mensagem = "Não foi possível ler os dados enviados.") =>
  new ErroAplicacao(400, mensagem);

const naoAutenticado = (mensagem = "Sua sessão expirou ou é inválida. Entre novamente.") =>
  new ErroAplicacao(401, mensagem);

const semPermissao = (mensagem = "Você não tem permissão para esta operação.") =>
  new ErroAplicacao(403, mensagem);

const naoEncontrado = (mensagem = "Registro não encontrado.") =>
  new ErroAplicacao(404, mensagem);

const conflitoDeVersao = (mensagem = "Este registro foi alterado por outra pessoa. Atualize e tente novamente.") =>
  new ErroAplicacao(409, mensagem);

// campos: lista de { campo, mensagem }, a primeira mensagem vira o resumo
const falhaDeValidacao = (campos) =>
  new ErroAplicacao(422, campos[0]?.mensagem ?? "Confira os dados informados.", campos);

module.exports = {
  ErroAplicacao,
  requisicaoMalformada,
  naoAutenticado,
  semPermissao,
  naoEncontrado,
  conflitoDeVersao,
  falhaDeValidacao,
};
