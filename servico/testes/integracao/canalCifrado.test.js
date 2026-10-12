// RNF02: requisicao em canal nao cifrado e rejeitada (decisao 9.5).

const http = require("node:http");
const { criarListenerNaoCifrado } = require("../../src/app");

function requisitar(porta, caminho, metodo = "GET") {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port: porta, path: caminho, method: metodo }, (res) => {
      let corpo = "";
      res.on("data", (parte) => (corpo += parte));
      res.on("end", () => resolve({ status: res.statusCode, corpo: JSON.parse(corpo) }));
    });
    req.on("error", reject);
    req.end();
  });
}

describe("RNF02 - canal nao cifrado", () => {
  let servidor;
  let porta;

  beforeAll(async () => {
    servidor = criarListenerNaoCifrado();
    await new Promise((resolve) => servidor.listen(0, "127.0.0.1", resolve));
    porta = servidor.address().port;
  });

  afterAll(() => new Promise((resolve) => servidor.close(resolve)));

  test.each([
    ["GET", "/animais"],
    ["POST", "/auth/login"],
    ["GET", "/saude-servico"],
  ])("%s %s em HTTP responde 426", async (metodo, caminho) => {
    const resposta = await requisitar(porta, caminho, metodo);
    expect(resposta.status).toBe(426);
    expect(resposta.corpo).toEqual({ erro: "Conexão não segura. Use o endereço com https." });
  });
});
