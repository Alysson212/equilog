// Autenticacao por token de acesso no cabecalho Authorization (RFC 6750).
// Falha responde 401 e e registrada na trilha de auditoria (RNF04).

const { verificarTokenAcesso } = require("../servicos/autenticacaoServico");
const auditoria = require("../servicos/auditoriaServico");
const { naoAutenticado } = require("../dominio/erros");

async function autenticar(req, res, next) {
  const [esquema, token] = (req.get("authorization") ?? "").split(" ");
  try {
    if (esquema !== "Bearer" || !token) throw naoAutenticado();
    req.usuario = { id: verificarTokenAcesso(token) };
    return next();
  } catch (erro) {
    try {
      await auditoria.registrar({
        acao: "acesso_negado",
        motivo: token ? "token_invalido" : "token_ausente",
        entidade: "rota",
        entidadeId: `${req.method} ${req.baseUrl}${req.path}`,
        enderecoIp: req.contextoAuditoria?.enderecoIp,
      });
    } catch (falhaAuditoria) {
      return next(falhaAuditoria);
    }
    return next(erro);
  }
}

module.exports = { autenticar };
