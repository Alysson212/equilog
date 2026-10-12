// Executado antes de cada arquivo de teste: carrega o .env, aponta o Prisma
// para o banco exclusivo de testes e os anexos para um diretorio temporario.

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const arquivoEnv = path.join(__dirname, "..", "..", ".env");
if (fs.existsSync(arquivoEnv)) process.loadEnvFile(arquivoEnv);

const { exigirBancoDeTeste } = require("./bancoDeTeste");

process.env.DATABASE_URL = exigirBancoDeTeste();
process.env.DIRETORIO_ANEXOS = path.join(os.tmpdir(), "equilog-anexos-teste");
