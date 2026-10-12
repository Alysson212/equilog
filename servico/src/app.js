// Aplicacao Express do servico EquiLog.
// Exporta o app (usado pelos testes de integracao) e, quando executado
// diretamente, sobe o servidor HTTPS e o listener HTTP que recusa canal nao
// cifrado com 426 (RNF02; especificacao, decisao 9.5).

const fs = require("node:fs");
const http = require("node:http");
const https = require("node:https");
const express = require("express");

const { contextoAuditoria } = require("./middlewares/auditoria");
const { ErroAplicacao } = require("./dominio/erros");
const rotasAutenticacao = require("./rotas/autenticacao");
const rotasUsuarios = require("./rotas/usuarios");
const rotasAnimais = require("./rotas/animais");
const rotasAcessos = require("./rotas/acessos");
const rotasEventos = require("./rotas/eventos");

const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));
app.use(contextoAuditoria);

app.get("/saude-servico", (req, res) => {
  res.status(200).json({ situacao: "ativo" });
});

app.use("/auth", rotasAutenticacao);
app.use("/usuarios", rotasUsuarios);
app.use("/animais", rotasAnimais);
app.use("/acessos", rotasAcessos);
app.use("/eventos", rotasEventos);

app.use((req, res) => {
  res.status(404).json({ erro: "Endereço não encontrado." });
});

// Tratador de erros: mensagens em linguagem comum, sem detalhe interno (RNF08)
// eslint-disable-next-line no-unused-vars
app.use((erro, req, res, next) => {
  if (erro instanceof ErroAplicacao) {
    const corpo = { erro: erro.message };
    if (erro.campos) corpo.campos = erro.campos;
    return res.status(erro.status).json(corpo);
  }
  if (erro.type === "entity.parse.failed") {
    return res.status(400).json({ erro: "Não foi possível ler os dados enviados." });
  }
  if (erro.type === "entity.too.large") {
    return res.status(400).json({ erro: "Os dados enviados são grandes demais." });
  }
  console.error(erro);
  return res.status(500).json({ erro: "Ocorreu um erro inesperado. Tente novamente em instantes." });
});

function criarListenerNaoCifrado() {
  return http.createServer((req, res) => {
    res.writeHead(426, {
      "Content-Type": "application/json; charset=utf-8",
      Upgrade: "TLS/1.2, HTTP/1.1",
      Connection: "Upgrade",
    });
    res.end(JSON.stringify({ erro: "Conexão não segura. Use o endereço com https." }));
  });
}

function iniciar() {
  const portaHttps = Number(process.env.PORTA_HTTPS ?? 3443);
  const portaHttp = Number(process.env.PORTA_HTTP ?? 3080);
  const credenciais = {
    key: fs.readFileSync(process.env.TLS_CHAVE ?? "certs/servidor.key"),
    cert: fs.readFileSync(process.env.TLS_CERTIFICADO ?? "certs/servidor.crt"),
  };

  https.createServer(credenciais, app).listen(portaHttps, () => {
    console.log(`EquiLog: HTTPS na porta ${portaHttps}`);
  });
  criarListenerNaoCifrado().listen(portaHttp, () => {
    console.log(`EquiLog: HTTP na porta ${portaHttp} responde 426`);
  });
}

if (require.main === module) {
  iniciar();
}

module.exports = { app, criarListenerNaoCifrado };
