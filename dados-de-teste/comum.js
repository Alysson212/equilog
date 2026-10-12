// Apoio dos scripts de massa de teste: dependencias do servico, conexao com o
// banco configurado em servico/.env e travas de seguranca.

const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");

const raizServico = path.join(__dirname, "..", "servico");
const requireServico = createRequire(path.join(raizServico, "package.json"));

const arquivoEnv = path.join(raizServico, ".env");
if (fs.existsSync(arquivoEnv)) process.loadEnvFile(arquivoEnv);

const { PrismaClient } = requireServico("@prisma/client");
const bcrypt = requireServico("bcrypt");

// Apenas banco local: os scripts apagam dados de uso
function exigirBancoLocal() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Defina DATABASE_URL em servico/.env.");
  const { hostname } = new URL(url);
  if (!["127.0.0.1", "localhost", "banco"].includes(hostname)) {
    throw new Error(`Banco em "${hostname}" recusado: os scripts de massa de teste so rodam em banco local.`);
  }
  return url;
}

module.exports = { PrismaClient, bcrypt, exigirBancoLocal, raizServico };
