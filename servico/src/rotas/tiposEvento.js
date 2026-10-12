// GET /tipos-evento: tipos de registro por dominio, com exige_retorno, para os
// formularios do aplicativo. exige_retorno apenas torna a data de retorno
// obrigatoria no formulario; nenhuma data e calculada (RNF11).

const express = require("express");
const { assincrono } = require("./apoio");
const { autenticar } = require("../middlewares/autenticacao");
const tipoEventoRepo = require("../repositorios/tipoEventoRepo");

const rotas = express.Router();

rotas.get(
  "/",
  autenticar,
  assincrono(async (req, res) => {
    const tipos = await tipoEventoRepo.listarTodos();
    res.status(200).json({
      itens: tipos.map((t) => ({ dominio: t.dominio, nome: t.nome, exigeRetorno: t.exigeRetorno })),
    });
  }),
);

module.exports = rotas;
