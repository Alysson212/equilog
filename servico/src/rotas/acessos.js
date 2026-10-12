// DELETE /acessos/{id}: revogacao de vinculo pelo proprietario (RF07)

const express = require("express");
const { assincrono } = require("./apoio");
const { autenticar } = require("../middlewares/autenticacao");
const { autorizar } = require("../middlewares/autorizacao");
const { carregarRecurso } = require("../middlewares/carregarRecurso");
const vinculoRepo = require("../repositorios/vinculoRepo");
const acessoServico = require("../servicos/acessoServico");

const rotas = express.Router();

rotas.delete(
  "/:acessoId",
  autenticar,
  carregarRecurso((req) => vinculoRepo.buscarPorId(req.params.acessoId)),
  autorizar("editar", "acesso"),
  assincrono(async (req, res) => {
    await acessoServico.revogar(req.contextoAuditoria, req.recurso);
    res.status(204).end();
  }),
);

module.exports = rotas;
