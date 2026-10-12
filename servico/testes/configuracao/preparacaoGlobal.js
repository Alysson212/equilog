// Executado uma vez antes da suite: leva o banco de testes ao esquema das
// migracoes versionadas (migrate deploy, nao destrutivo) e aplica o seed, que
// e idempotente. Os dados de uso sao apagados por limparBase antes de cada teste.

const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

module.exports = async function preparacaoGlobal() {
  const raiz = path.join(__dirname, "..", "..");
  const arquivoEnv = path.join(raiz, ".env");
  if (fs.existsSync(arquivoEnv)) process.loadEnvFile(arquivoEnv);

  const { exigirBancoDeTeste } = require("./bancoDeTeste");
  const env = { ...process.env, DATABASE_URL: exigirBancoDeTeste() };

  execSync("npx prisma migrate deploy", { cwd: raiz, env, stdio: "ignore" });
  execSync("npx prisma db seed", { cwd: raiz, env, stdio: "ignore" });
};
