// /animais: listagem, cadastro, consulta e edicao (RF04, RF05, RF08),
// concessao de acesso (RF06) e recursos aninhados do animal.

const express = require("express");
const { assincrono } = require("./apoio");
const { autenticar } = require("../middlewares/autenticacao");
const { autorizar } = require("../middlewares/autorizacao");
const animalServico = require("../servicos/animalServico");
const acessoServico = require("../servicos/acessoServico");
const trilhaAuditoriaServico = require("../servicos/trilhaAuditoriaServico");
const rotasEventosDoAnimal = require("./eventosDoAnimal");

const rotas = express.Router();

rotas.use(autenticar);

rotas.get(
  "/",
  assincrono(async (req, res) => {
    res.status(200).json({ itens: await animalServico.listar(req.usuario.id) });
  }),
);

// Decisao 9.2: sem autorizar, porque antes da criacao nao ha animal nem vinculo
rotas.post(
  "/",
  assincrono(async (req, res) => {
    const animal = await animalServico.cadastrar(req.contextoAuditoria, req.body);
    res.status(201).location(`/animais/${animal.id}`).json(animal);
  }),
);

rotas.get(
  "/:animalId",
  autorizar("ler", "animal"),
  assincrono(async (req, res) => {
    res.status(200).json(await animalServico.consultar(req.vinculo));
  }),
);

rotas.patch(
  "/:animalId",
  autorizar("editar", "animal"),
  assincrono(async (req, res) => {
    res.status(200).json(await animalServico.editar(req.contextoAuditoria, req.vinculo, req.body));
  }),
);

rotas.post(
  "/:animalId/acessos",
  autorizar("criar", "acesso"),
  assincrono(async (req, res) => {
    const vinculo = await acessoServico.conceder(req.contextoAuditoria, req.params.animalId, req.body);
    res.status(201).location(`/acessos/${vinculo.id}`).json(vinculo);
  }),
);

// RF23: trilha de auditoria do animal, apenas o proprietario
rotas.get(
  "/:animalId/auditoria",
  autorizar("ler", "auditoria"),
  assincrono(async (req, res) => {
    res.status(200).json(await trilhaAuditoriaServico.consultarDoAnimal(req.params.animalId, req.query));
  }),
);

rotas.use("/:animalId/eventos", rotasEventosDoAnimal);

module.exports = rotas;
