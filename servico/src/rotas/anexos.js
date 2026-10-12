// GET /anexos/{id}: download do arquivo, com a mesma autorizacao de leitura
// do dominio do evento ao qual o anexo pertence (e L na linha de anexos).

const express = require("express");
const { assincrono } = require("./apoio");
const { autenticar } = require("../middlewares/autenticacao");
const { autorizar } = require("../middlewares/autorizacao");
const { carregarRecurso } = require("../middlewares/carregarRecurso");
const anexoRepo = require("../repositorios/anexoRepo");
const anexoServico = require("../servicos/anexoServico");

const rotas = express.Router();

// anexo de evento excluido logicamente deixa de ser servido
async function buscarAnexoAtivo(req) {
  const anexo = await anexoRepo.buscarPorId(req.params.anexoId);
  if (!anexo || anexo.evento.excluidoEm) return null;
  return { ...anexo, animalId: anexo.evento.animalId };
}

rotas.get(
  "/:anexoId",
  autenticar,
  carregarRecurso(buscarAnexoAtivo),
  autorizar("ler", "anexo"),
  autorizar("ler", (req) => req.recurso.evento.tipoEvento.dominio),
  assincrono(async (req, res) => {
    const arquivo = await anexoServico.localizar(req.recurso);
    res.set("Content-Type", arquivo.mimeType);
    res.set("X-Content-Type-Options", "nosniff");
    res.attachment(arquivo.nomeArquivo);
    res.sendFile(arquivo.caminhoAbsoluto);
  }),
);

module.exports = rotas;
