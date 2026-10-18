// Cadastro de usuario (RF01). Apenas nome, e-mail e telefone (RNF12).

const usuarioRepo = require("../repositorios/usuarioRepo");
const { emTransacao, violouUnicidade } = require("../repositorios/prisma");
const auditoria = require("./auditoriaServico");
const { resumirSenha } = require("./autenticacaoServico");
const { gerarCodigo, normalizarCodigo } = require("../dominio/codigoRecuperacao");
const { falhaDeValidacao } = require("../dominio/erros");
const { validarObjeto, exigirObjeto, lancarSeHouverErros } = require("../dominio/validacao");

const REGRAS_CADASTRO = {
  nome: { tipo: "texto", obrigatorio: true, max: 120, rotulo: "o nome" },
  email: { tipo: "email", obrigatorio: true, max: 160, rotulo: "o e-mail" },
  telefone: { tipo: "texto", max: 20, rotulo: "o telefone" },
  // bcrypt considera no maximo 72 bytes
  senha: { tipo: "senha", obrigatorio: true, min: 8, max: 72, rotulo: "a senha" },
};

const EMAIL_EM_USO = { campo: "email", mensagem: "Já existe uma conta com este e-mail." };

function paraRepresentacao(usuario) {
  return { id: usuario.id, nome: usuario.nome, email: usuario.email, telefone: usuario.telefone };
}

async function cadastrar(contexto, corpo) {
  const { valores, erros } = validarObjeto(exigirObjeto(corpo), REGRAS_CADASTRO);
  if (valores.telefone && !/^[0-9+()\-\s]+$/.test(valores.telefone)) {
    erros.push({ campo: "telefone", mensagem: "O telefone deve conter apenas números, espaços, parênteses, hífen ou +." });
  }
  lancarSeHouverErros(erros);

  if (await usuarioRepo.buscarPorEmail(valores.email)) throw falhaDeValidacao([EMAIL_EM_USO]);

  // o codigo de recuperacao e devolvido uma unica vez, nesta resposta (decisao 9.7)
  const codigoRecuperacao = gerarCodigo();
  const [senhaHash, codigoRecuperacaoHash] = await Promise.all([
    resumirSenha(valores.senha),
    resumirSenha(normalizarCodigo(codigoRecuperacao)),
  ]);
  try {
    const usuario = await emTransacao(async (tx) => {
      const criado = await usuarioRepo.criar(
        { nome: valores.nome, email: valores.email, telefone: valores.telefone, senhaHash, codigoRecuperacaoHash },
        tx,
      );
      await auditoria.registrar(
        { usuarioId: criado.id, acao: "usuario_criado", entidade: "usuario", entidadeId: criado.id, enderecoIp: contexto.enderecoIp },
        tx,
      );
      return criado;
    });
    return { ...paraRepresentacao(usuario), codigoRecuperacao };
  } catch (erro) {
    if (violouUnicidade(erro)) throw falhaDeValidacao([EMAIL_EM_USO]);
    throw erro;
  }
}

module.exports = { cadastrar };
