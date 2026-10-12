// GET /lembretes (RF18) e PATCH /lembretes/{id} (RF19)

const express = require("express");
const { assincrono } = require("./apoio");
const { autenticar } = require("../middlewares/autenticacao");
const { autorizar } = require("../middlewares/autorizacao");
const { carregarRecurso } = require("../middlewares/carregarRecurso");
const lembreteRepo = require("../repositorios/lembreteRepo");
const lembreteServico = require("../servicos/lembreteServico");

const rotas = express.Router();

rotas.use(autenticar);

// Lembretes dos animais em que o usuario tem vinculo vigente
rotas.get(
  "/",
  assincrono(async (req, res) => {
    res.status(200).json({ itens: await lembreteServico.listar(req.usuario.id, req.query) });
  }),
);

// Lembrete de evento excluido logicamente nao e mais alteravel
async function buscarLembreteAtivo(req) {
  const lembrete = await lembreteRepo.buscarPorId(req.params.lembreteId);
  return lembrete && !lembrete.evento.excluidoEm ? lembrete : null;
}

rotas.patch(
  "/:lembreteId",
  carregarRecurso(buscarLembreteAtivo),
  autorizar("editar", "lembrete"),
  assincrono(async (req, res) => {
    res.status(200).json(await lembreteServico.alterarEstado(req.contextoAuditoria, req.vinculo, req.recurso, req.body));
  }),
);

module.exports = rotas;
