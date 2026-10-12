// Middleware unico de autorizacao (RNF03; Trecho de codigo 3 e Figura 6 do TCC).
// Resolve o vinculo vigente pela tripla usuario, animal e papel na data corrente,
// a cada requisicao (RF07), e consulta a matriz do modulo de dominio.
// As duas negacoes sao gravadas em auditoria com motivos distintos (RNF04).

const { buscarVinculoVigente } = require("../repositorios/vinculoRepo");
const { papelPode } = require("../dominio/matrizPermissoes");
const { registrar } = require("../servicos/auditoriaServico");

/**
 * Verifica se o usuario autenticado pode executar <acao> sobre a <operacao>
 * do animal indicado na rota ou no recurso carregado.
 * acao: "criar" | "ler" | "editar"
 * operacao: linha da matriz, ou funcao (req) => linha, quando depende do recurso
 *           ou do corpo (por exemplo, o dominio do evento)
 */
function autorizar(acao, operacao) {
  return async function (req, res, next) {
    try {
      const usuarioId = req.usuario.id; // vem do middleware de autenticacao
      const animalId = req.params.animalId ?? req.recurso?.animalId;
      const linha = typeof operacao === "function" ? operacao(req) : operacao;
      const enderecoIp = req.contextoAuditoria?.enderecoIp;

      const vinculo = await buscarVinculoVigente(usuarioId, animalId, new Date());
      if (!vinculo) {
        await registrar({ usuarioId, acao: "acesso_negado", entidade: "animal", entidadeId: animalId, motivo: "sem_vinculo", enderecoIp });
        return res.status(403).json({ erro: "Você não tem acesso a este animal." });
      }

      if (!papelPode(vinculo.papel, acao, linha)) {
        await registrar({ usuarioId, acao: "acesso_negado", entidade: linha, entidadeId: animalId, motivo: "papel_insuficiente", enderecoIp });
        return res.status(403).json({ erro: "Seu papel neste animal não permite esta operação." });
      }

      req.vinculo = vinculo; // disponivel para a camada de servico
      return next();
    } catch (erro) {
      return next(erro);
    }
  };
}

module.exports = { autorizar };
