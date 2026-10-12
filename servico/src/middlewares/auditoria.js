// Contexto de auditoria da requisicao: quem (usuario autenticado, quando houver)
// e de onde (endereco IP). Os servicos recebem este contexto e o gravam em cada
// registro da trilha (RNF04).

function contextoAuditoria(req, res, next) {
  req.contextoAuditoria = {
    get usuarioId() {
      return req.usuario?.id ?? null;
    },
    enderecoIp: req.ip ?? null,
  };
  next();
}

module.exports = { contextoAuditoria };
