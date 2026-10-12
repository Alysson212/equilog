// Trilha de auditoria (RNF04): toda escrita e toda negacao.
// Para escritas, o registro e gravado na mesma transacao da operacao (db = tx),
// de modo que nao exista escrita sem trilha nem trilha de escrita desfeita.

const auditoriaRepo = require("../repositorios/auditoriaRepo");

function registrar(
  { usuarioId = null, identificadorTentativa = null, acao, entidade = null, entidadeId = null, motivo = null, enderecoIp = null },
  db,
) {
  return auditoriaRepo.criar(
    {
      usuarioId,
      identificadorTentativa: identificadorTentativa ? String(identificadorTentativa).slice(0, 160) : null,
      acao,
      entidade,
      entidadeId: entidadeId ? String(entidadeId).slice(0, 60) : null,
      motivo,
      enderecoIp: enderecoIp ? String(enderecoIp).slice(0, 45) : null,
    },
    db,
  );
}

module.exports = { registrar };
