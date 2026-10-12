// POST /usuarios (RF01), publico

const express = require("express");
const { assincrono } = require("./apoio");
const usuarioServico = require("../servicos/usuarioServico");

const rotas = express.Router();

rotas.post(
  "/",
  assincrono(async (req, res) => {
    const usuario = await usuarioServico.cadastrar(req.contextoAuditoria, req.body);
    res.status(201).location(`/usuarios/${usuario.id}`).json(usuario);
  }),
);

module.exports = rotas;
