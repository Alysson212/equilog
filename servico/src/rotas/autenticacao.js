// POST /auth/login (RF02) e POST /auth/refresh (RF03)

const express = require("express");
const { assincrono } = require("./apoio");
const autenticacaoServico = require("../servicos/autenticacaoServico");

const rotas = express.Router();

rotas.post(
  "/login",
  assincrono(async (req, res) => {
    res.status(200).json(await autenticacaoServico.entrar(req.contextoAuditoria, req.body));
  }),
);

rotas.post(
  "/refresh",
  assincrono(async (req, res) => {
    res.status(200).json(await autenticacaoServico.renovar(req.contextoAuditoria, req.body));
  }),
);

module.exports = rotas;
