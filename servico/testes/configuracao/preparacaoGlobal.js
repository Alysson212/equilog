// Executado uma vez antes da suite: leva o banco de testes ao esquema das
// migracoes versionadas (migrate deploy, nao destrutivo), confirma pela conexao
// que o banco e o equilog_teste e aplica o seed, que e idempotente. Os dados de
// uso sao apagados por limparBase antes de cada teste.

const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

module.exports = async function preparacaoGlobal() {
  const raiz = path.join(__dirname, "..", "..");
  const arquivoEnv = path.join(raiz, ".env");
  if (fs.existsSync(arquivoEnv)) process.loadEnvFile(arquivoEnv);

  const { exigirBancoDeTeste, confirmarConexaoDeTeste } = require("./bancoDeTeste");
  const url = exigirBancoDeTeste();
  const env = { ...process.env, DATABASE_URL: url };

  execSync("npx prisma migrate deploy", { cwd: raiz, env, stdio: "ignore" });

  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient({ datasourceUrl: url });
  try {
    await confirmarConexaoDeTeste(prisma);
  } finally {
    await prisma.$disconnect();
  }

  execSync("npx prisma db seed", { cwd: raiz, env, stdio: "ignore" });
};
