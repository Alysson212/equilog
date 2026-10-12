// /eventos/{id}: edicao pelo autor (RF15) e exclusao logica pelo autor ou pelo
// proprietario (RF16). O evento e carregado antes da autorizacao para que o
// middleware conheca o animal e o dominio a que ele pertence.

const express = require("express");
const { assincrono } = require("./apoio");
const { autenticar } = require("../middlewares/autenticacao");
const { autorizar } = require("../middlewares/autorizacao");
const { carregarRecurso } = require("../middlewares/carregarRecurso");
const eventoRepo = require("../repositorios/eventoRepo");
const eventoServico = require("../servicos/eventoServico");

const rotas = express.Router();

const dominioDoEvento = (req) => req.recurso.tipoEvento.dominio;

rotas.use(autenticar);

rotas.patch(
  "/:eventoId",
  carregarRecurso((req) => eventoRepo.buscarAtivo(req.params.eventoId)),
  autorizar("editar", dominioDoEvento),
  assincrono(async (req, res) => {
    res.status(200).json(await eventoServico.editar(req.contextoAuditoria, req.recurso, req.body));
  }),
);

rotas.delete(
  "/:eventoId",
  carregarRecurso((req) => eventoRepo.buscarAtivo(req.params.eventoId)),
  autorizar("ler", dominioDoEvento),
  assincrono(async (req, res) => {
    await eventoServico.excluir(req.contextoAuditoria, req.vinculo, req.recurso);
    res.status(204).end();
  }),
);

module.exports = rotas;
