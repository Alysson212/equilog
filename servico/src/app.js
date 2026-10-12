// Aplicacao Express do servico EquiLog.
// Exporta o app (usado pelos testes de integracao) e, quando executado
// diretamente, sobe o servidor HTTPS e o listener HTTP que recusa canal nao
// cifrado com 426 (RNF02; especificacao, decisao 9.5).

const fs = require("node:fs");
const http = require("node:http");
const https = require("node:https");
const express = require("express");

const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));

app.get("/saude-servico", (req, res) => {
  res.status(200).json({ situacao: "ativo" });
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
