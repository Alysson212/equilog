// Executado antes de cada arquivo de teste: carrega o .env e aponta o Prisma
// para o banco exclusivo de testes.

const fs = require("node:fs");
const path = require("node:path");

const arquivoEnv = path.join(__dirname, "..", "..", ".env");
if (fs.existsSync(arquivoEnv)) process.loadEnvFile(arquivoEnv);

const { exigirBancoDeTeste } = require("./bancoDeTeste");

process.env.DATABASE_URL = exigirBancoDeTeste();
