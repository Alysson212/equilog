// /animais/{id}/eventos: registro de evento (RF09 a RF12) e linha do tempo
// (RF13, RF14). O dominio do evento decide a linha da matriz consultada.

const express = require("express");
const { assincrono } = require("./apoio");
const { autorizar } = require("../middlewares/autorizacao");
const { DOMINIOS_EVENTO } = require("../dominio/matrizPermissoes");
const { exigirObjeto } = require("../dominio/validacao");
const { falhaDeValidacao } = require("../dominio/erros");

const rotas = express.Router({ mergeParams: true });

// Validacao sintatica do dominio: sem ele nao ha linha da matriz a consultar
function exigirDominio(req, res, next) {
  try {
    const { dominio } = exigirObjeto(req.body);
    if (!DOMINIOS_EVENTO.includes(dominio)) {
      throw falhaDeValidacao([
        { campo: "dominio", mensagem: "Escolha o tipo de registro: saúde, manejo, treinamento ou competição." },
      ]);
    }
    return next();
  } catch (erro) {
    return next(erro);
  }
}

rotas.post(
  "/",
  exigirDominio,
  autorizar("criar", (req) => req.body.dominio),
  assincrono(async (req, res) => {
    // registro implementado na Etapa 3
    res.status(501).json({ erro: "Registro de eventos ainda não disponível." });
  }),
);

module.exports = rotas;
