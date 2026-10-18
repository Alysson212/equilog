// Autenticacao (RF02, RF03): bcrypt custo 12, token de acesso de 15 minutos e
// de renovacao de 30 dias. Os tokens carregam apenas o identificador do usuario
// (sub), o momento de emissao e o de expiracao, sem papeis (especificacao, secao 10, regra 4).

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const usuarioRepo = require("../repositorios/usuarioRepo");
const auditoria = require("./auditoriaServico");
const { configuracao } = require("./configuracao");
const { emTransacao } = require("../repositorios/prisma");
const { gerarCodigo, normalizarCodigo } = require("../dominio/codigoRecuperacao");
const { naoAutenticado } = require("../dominio/erros");
const { validarObjeto, exigirObjeto, lancarSeHouverErros } = require("../dominio/validacao");

const ALGORITMO = "HS256";
const MENSAGEM_LOGIN_INVALIDO = "E-mail ou senha não conferem.";
const MENSAGEM_RECUPERACAO_INVALIDA = "E-mail ou código de recuperação não conferem.";

// Resumo usado quando o e-mail nao existe, para que a resposta leve o mesmo
// tempo de uma senha incorreta e nao revele quais e-mails estao cadastrados.
let resumoFicticio;
async function obterResumoFicticio() {
  resumoFicticio ??= await bcrypt.hash("resumo-ficticio-para-tempo-constante", configuracao.custoBcrypt);
  return resumoFicticio;
}

function resumirSenha(senha) {
  return bcrypt.hash(senha, configuracao.custoBcrypt);
}

function emitirTokens(usuarioId) {
  return {
    tokenAcesso: jwt.sign({}, configuracao.segredoAcesso, {
      algorithm: ALGORITMO,
      subject: usuarioId,
      expiresIn: configuracao.validadeAcesso,
    }),
    tokenRenovacao: jwt.sign({}, configuracao.segredoRenovacao, {
      algorithm: ALGORITMO,
      subject: usuarioId,
      expiresIn: configuracao.validadeRenovacao,
    }),
  };
}

// Devolve o identificador do usuario ou lanca 401
function verificarTokenAcesso(token) {
  try {
    const conteudo = jwt.verify(token, configuracao.segredoAcesso, { algorithms: [ALGORITMO] });
    if (!conteudo.sub) throw new Error("sem sub");
    return conteudo.sub;
  } catch {
    throw naoAutenticado();
  }
}

const REGRAS_LOGIN = {
  email: { tipo: "texto", obrigatorio: true, max: 320, rotulo: "o e-mail" },
  senha: { tipo: "texto", obrigatorio: true, max: 1024, rotulo: "a senha" },
};

async function entrar(contexto, corpo) {
  const { valores, erros } = validarObjeto(exigirObjeto(corpo), REGRAS_LOGIN);
  lancarSeHouverErros(erros);

  const email = valores.email.toLowerCase();
  const usuario = await usuarioRepo.buscarPorEmail(email);
  // a senha e comparada mesmo sem usuario, contra o resumo ficticio
  const confere = await bcrypt.compare(corpo.senha, usuario?.senhaHash ?? (await obterResumoFicticio()));

  if (!usuario || !confere || !usuario.ativo) {
    const motivo = !usuario ? "usuario_inexistente" : !confere ? "senha_incorreta" : "conta_inativa";
    await auditoria.registrar({
      usuarioId: usuario?.id ?? null,
      identificadorTentativa: usuario ? null : email,
      acao: "login_negado",
      entidade: "usuario",
      entidadeId: usuario?.id ?? null,
      motivo,
      enderecoIp: contexto.enderecoIp,
    });
    // mesma resposta para os tres motivos: nao revela qual campo esta errado
    throw naoAutenticado(MENSAGEM_LOGIN_INVALIDO);
  }

  await auditoria.registrar({
    usuarioId: usuario.id,
    acao: "login_realizado",
    entidade: "usuario",
    entidadeId: usuario.id,
    enderecoIp: contexto.enderecoIp,
  });

  return {
    ...emitirTokens(usuario.id),
    usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email },
  };
}

async function renovar(contexto, corpo) {
  const token = exigirObjeto(corpo).tokenRenovacao;
  let usuarioId = null;
  try {
    if (typeof token !== "string" || !token) throw new Error("ausente");
    usuarioId = jwt.verify(token, configuracao.segredoRenovacao, { algorithms: [ALGORITMO] }).sub;
  } catch {
    usuarioId = null;
  }

  const usuario = usuarioId ? await usuarioRepo.buscarPorId(usuarioId) : null;
  if (!usuario || !usuario.ativo) {
    await auditoria.registrar({
      usuarioId: usuario?.id ?? null,
      acao: "renovacao_negada",
      entidade: "usuario",
      entidadeId: usuario?.id ?? null,
      motivo: usuario ? "conta_inativa" : "token_invalido",
      enderecoIp: contexto.enderecoIp,
    });
    throw naoAutenticado();
  }

  return emitirTokens(usuario.id);
}

const REGRAS_RECUPERACAO = {
  email: { tipo: "texto", obrigatorio: true, max: 320, rotulo: "o e-mail" },
  codigoRecuperacao: { tipo: "texto", obrigatorio: true, max: 64, rotulo: "o código de recuperação" },
  // mesmas regras do cadastro (RF01)
  novaSenha: { tipo: "senha", obrigatorio: true, min: 8, max: 72, rotulo: "a nova senha" },
};

// Recuperacao de senha sem e-mail (decisao 9.7): quem apresenta o codigo
// recebido no cadastro define nova senha e recebe um novo codigo; o anterior
// deixa de valer. Mesma resposta para todos os motivos de recusa.
async function recuperarSenha(contexto, corpo) {
  const { valores, erros } = validarObjeto(exigirObjeto(corpo), REGRAS_RECUPERACAO);
  lancarSeHouverErros(erros);

  const email = valores.email.toLowerCase();
  const usuario = await usuarioRepo.buscarPorEmail(email);
  const resumoGravado = usuario?.codigoRecuperacaoHash ?? null;
  // compara mesmo sem usuario ou sem codigo, para manter o tempo de resposta
  const confere = await bcrypt.compare(normalizarCodigo(valores.codigoRecuperacao), resumoGravado ?? (await obterResumoFicticio()));

  const negar = async (motivo) => {
    await auditoria.registrar({
      usuarioId: usuario?.id ?? null,
      identificadorTentativa: usuario ? null : email,
      acao: "recuperacao_negada",
      entidade: "usuario",
      entidadeId: usuario?.id ?? null,
      motivo,
      enderecoIp: contexto.enderecoIp,
    });
    throw naoAutenticado(MENSAGEM_RECUPERACAO_INVALIDA);
  };

  if (!usuario) return negar("usuario_inexistente");
  if (!resumoGravado) return negar("sem_codigo");
  if (!confere) return negar("codigo_incorreto");
  if (!usuario.ativo) return negar("conta_inativa");

  const novoCodigo = gerarCodigo();
  const [senhaHash, codigoRecuperacaoHash] = await Promise.all([
    resumirSenha(valores.novaSenha),
    resumirSenha(normalizarCodigo(novoCodigo)),
  ]);
  const trocou = await emTransacao(async (tx) => {
    const ok = await usuarioRepo.trocarCredenciais(usuario.id, resumoGravado, { senhaHash, codigoRecuperacaoHash }, tx);
    if (ok) {
      await auditoria.registrar(
        { usuarioId: usuario.id, acao: "senha_redefinida", entidade: "usuario", entidadeId: usuario.id, enderecoIp: contexto.enderecoIp },
        tx,
      );
    }
    return ok;
  });
  // outra recuperacao usou o mesmo codigo no intervalo
  if (!trocou) return negar("codigo_ja_usado");

  return { codigoRecuperacao: novoCodigo };
}

module.exports = { entrar, renovar, recuperarSenha, verificarTokenAcesso, resumirSenha, emitirTokens };
