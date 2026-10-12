// POST /sincronizacao/lote (RF21; decisao 9.3)

const express = require("express");
const { assincrono } = require("./apoio");
const { autenticar } = require("../middlewares/autenticacao");
const sincronizacaoServico = require("../servicos/sincronizacaoServico");

const rotas = express.Router();

rotas.post(
  "/lote",
  autenticar,
  assincrono(async (req, res) => {
    res.status(200).json(await sincronizacaoServico.sincronizarLote(req.contextoAuditoria, req.body));
  }),
);

module.exports = rotas;
