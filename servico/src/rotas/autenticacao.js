// POST /auth/login (RF02), POST /auth/refresh (RF03) e
// POST /auth/recuperar-senha (decisao 9.7)

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

rotas.post(
  "/recuperar-senha",
  assincrono(async (req, res) => {
    res.status(200).json(await autenticacaoServico.recuperarSenha(req.contextoAuditoria, req.body));
  }),
);

module.exports = rotas;
