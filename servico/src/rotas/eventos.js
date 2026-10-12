// /eventos/{id}: edicao pelo autor (RF15), exclusao logica pelo autor ou pelo
// proprietario (RF16) e anexo de arquivo (RF20). O evento e carregado antes da
// autorizacao para que o middleware conheca o animal e o dominio do evento.

const express = require("express");
const multer = require("multer");
const { assincrono } = require("./apoio");
const { autenticar } = require("../middlewares/autenticacao");
const { autorizar } = require("../middlewares/autorizacao");
const { carregarRecurso } = require("../middlewares/carregarRecurso");
const eventoRepo = require("../repositorios/eventoRepo");
const eventoServico = require("../servicos/eventoServico");
const anexoServico = require("../servicos/anexoServico");
const { configuracao } = require("../servicos/configuracao");
const { falhaDeValidacao } = require("../dominio/erros");

const rotas = express.Router();

const dominioDoEvento = (req) => req.recurso.tipoEvento.dominio;
const carregarEvento = carregarRecurso((req) => eventoRepo.buscarAtivo(req.params.eventoId));

// Upload em memoria, um arquivo por requisicao, recebido apenas depois da
// autorizacao: requisicao sem permissao nao chega a enviar o arquivo ao disco.
const receberArquivo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: configuracao.tamanhoMaximoAnexo, files: 1, fields: 5 },
}).single("arquivo");

function receberAnexo(req, res, next) {
  receberArquivo(req, res, (erro) => {
    if (!erro) return next();
    if (erro instanceof multer.MulterError) {
      const mensagem =
        erro.code === "LIMIT_FILE_SIZE"
          ? "O arquivo deve ter no máximo 10 MB."
          : "Envie um único arquivo no campo \"arquivo\".";
      return next(falhaDeValidacao([{ campo: "arquivo", mensagem }]));
    }
    return next(erro);
  });
}

rotas.use(autenticar);

rotas.patch(
  "/:eventoId",
  carregarEvento,
  autorizar("editar", dominioDoEvento),
  assincrono(async (req, res) => {
    res.status(200).json(await eventoServico.editar(req.contextoAuditoria, req.recurso, req.body));
  }),
);

rotas.delete(
  "/:eventoId",
  carregarEvento,
  autorizar("ler", dominioDoEvento),
  assincrono(async (req, res) => {
    await eventoServico.excluir(req.contextoAuditoria, req.vinculo, req.recurso);
    res.status(204).end();
  }),
);

// Anexar exige C na linha de anexos e leitura do dominio do evento
rotas.post(
  "/:eventoId/anexos",
  carregarEvento,
  autorizar("criar", "anexo"),
  autorizar("ler", dominioDoEvento),
  receberAnexo,
  assincrono(async (req, res) => {
    res.status(201).json(await anexoServico.anexar(req.contextoAuditoria, req.recurso, req.file));
  }),
);

module.exports = rotas;
