// Medicao do CT12 (RNF05: linha do tempo com 500 eventos em ate 2 s).
// Faz as requisicoes reais ao servico, por HTTPS, autenticado como o
// proprietario de teste (que le os quatro dominios), e mede o tempo de cada
// resposta completa, do envio ao ultimo byte. Nao arredonda nem descarta
// amostras alem do aquecimento declarado.
//
// Cenarios:
//   A. primeira pagina como o aplicativo a pede (limite=20);
//   B. pagina maxima da API (limite=100);
//   C. a linha do tempo inteira, percorrendo todas as paginas de 100.
//
// Limitacao: a medida e feita na propria maquina do servico (loopback), sem
// a latencia e a banda de uma rede movel real.
//
// Uso: node dados-de-teste/medir-ct12.js

const fs = require("node:fs");
const path = require("node:path");
const https = require("node:https");
const { raizServico } = require("./comum");

const URL_BASE = process.env.EQUILOG_API_URL ?? "https://127.0.0.1:3443";
const SENHA = process.env.SENHA_SESSAO ?? "sessao-equilog-2026";
const AQUECIMENTO = 3;
const AMOSTRAS = 30;
const AMOSTRAS_PERCURSO = 10;

const agente = new https.Agent({
  keepAlive: true,
  ca: fs.readFileSync(path.join(raizServico, "certs", "servidor.crt")),
});

function requisitar(metodo, caminho, { token, corpo } = {}) {
  return new Promise((resolve, reject) => {
    const inicio = process.hrtime.bigint();
    const req = https.request(
      new URL(caminho, URL_BASE),
      {
        method: metodo,
        agent: agente,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
      (res) => {
        const partes = [];
        res.on("data", (p) => partes.push(p));
        res.on("end", () => {
          const ms = Number(process.hrtime.bigint() - inicio) / 1e6;
          const bruto = Buffer.concat(partes);
          resolve({ status: res.statusCode, ms, bytes: bruto.length, corpo: JSON.parse(bruto.toString("utf8") || "null") });
        });
      },
    );
    req.on("error", reject);
    if (corpo) req.write(JSON.stringify(corpo));
    req.end();
  });
}

function estatisticas(valores) {
  const ordenados = [...valores].sort((a, b) => a - b);
  const quantil = (q) => ordenados[Math.min(ordenados.length - 1, Math.ceil(q * ordenados.length) - 1)];
  const media = valores.reduce((s, v) => s + v, 0) / valores.length;
  return {
    amostras: valores.length,
    minimo: ordenados[0],
    mediana: ordenados.length % 2 ? ordenados[(ordenados.length - 1) / 2] : (ordenados[ordenados.length / 2 - 1] + ordenados[ordenados.length / 2]) / 2,
    p95: quantil(0.95),
    maximo: ordenados[ordenados.length - 1],
    media,
  };
}

function imprimir(rotulo, est, extra = "") {
  const f = (v) => `${v.toFixed(2)} ms`;
  console.log(`${rotulo}${extra}`);
  console.log(`  amostras ${est.amostras} | min ${f(est.minimo)} | mediana ${f(est.mediana)} | p95 ${f(est.p95)} | max ${f(est.maximo)} | media ${f(est.media)}`);
}

async function main() {
  const login = await requisitar("POST", "/auth/login", { corpo: { email: "proprietario@sessao.equilog", senha: SENHA } });
  if (login.status !== 200) throw new Error(`Login falhou (${login.status}). Rode reinicializar.js e carregar-ct12.js antes.`);
  const token = login.corpo.tokenAcesso;

  const animais = await requisitar("GET", "/animais", { token });
  const animal = animais.corpo.itens.find((a) => a.nome === "Estrela do Sul");
  if (!animal) throw new Error("Animal 'Estrela do Sul' nao encontrado.");
  const base = `/animais/${animal.id}/eventos`;

  async function medirPagina(limite) {
    for (let i = 0; i < AQUECIMENTO; i += 1) await requisitar("GET", `${base}?limite=${limite}`, { token });
    const tempos = [];
    let ultima;
    for (let i = 0; i < AMOSTRAS; i += 1) {
      ultima = await requisitar("GET", `${base}?limite=${limite}`, { token });
      if (ultima.status !== 200) throw new Error(`Resposta ${ultima.status}`);
      tempos.push(ultima.ms);
    }
    return { est: estatisticas(tempos), total: ultima.corpo.total, itens: ultima.corpo.itens.length, bytes: ultima.bytes };
  }

  async function percorrerTudo() {
    const inicio = process.hrtime.bigint();
    let deslocamento = 0;
    let total = Infinity;
    let itens = 0;
    let bytes = 0;
    let paginas = 0;
    while (deslocamento < total) {
      const r = await requisitar("GET", `${base}?limite=100&deslocamento=${deslocamento}`, { token });
      if (r.status !== 200) throw new Error(`Resposta ${r.status}`);
      total = r.corpo.total;
      itens += r.corpo.itens.length;
      bytes += r.bytes;
      paginas += 1;
      deslocamento += 100;
    }
    return { ms: Number(process.hrtime.bigint() - inicio) / 1e6, itens, bytes, paginas };
  }

  console.log(`CT12 - ${new Date().toISOString()} - ${URL_BASE}`);
  const a = await medirPagina(20);
  console.log(`Linha do tempo de "${animal.nome}": ${a.total} eventos legiveis pelo proprietario.\n`);
  imprimir("A. primeira pagina, limite=20", a.est, ` (${a.itens} itens, ${a.bytes} bytes)`);
  const b = await medirPagina(100);
  imprimir("B. primeira pagina, limite=100", b.est, ` (${b.itens} itens, ${b.bytes} bytes)`);

  await percorrerTudo(); // aquecimento
  const percursos = [];
  let ultimo;
  for (let i = 0; i < AMOSTRAS_PERCURSO; i += 1) {
    ultimo = await percorrerTudo();
    percursos.push(ultimo.ms);
  }
  imprimir("C. linha do tempo inteira", estatisticas(percursos), ` (${ultimo.itens} itens em ${ultimo.paginas} paginas, ${ultimo.bytes} bytes)`);
  agente.destroy();
}

main().catch((erro) => {
  console.error(erro.message);
  process.exitCode = 1;
});
