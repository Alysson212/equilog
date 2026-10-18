// Cria .env (raiz) e servico/.env a partir dos modelos .env.example, com senha
// do banco e segredos JWT aleatorios. Os dois arquivos recebem a mesma senha.
// Nao sobrescreve arquivos existentes. Os arquivos .env nao sao versionados.
//
// Uso, a partir da raiz do repositorio:
//   node scripts/configurar-ambiente.js

const fs = require("node:fs");
const path = require("node:path");
const { randomBytes } = require("node:crypto");

const raiz = path.join(__dirname, "..");
const destinos = [
  { modelo: path.join(raiz, ".env.example"), arquivo: path.join(raiz, ".env") },
  { modelo: path.join(raiz, "servico", ".env.example"), arquivo: path.join(raiz, "servico", ".env") },
];

const existentes = destinos.filter((d) => fs.existsSync(d.arquivo));
if (existentes.length > 0) {
  console.error(`Ja existe: ${existentes.map((d) => path.relative(raiz, d.arquivo)).join(", ")}. Nada foi alterado.`);
  console.error("Apague os arquivos .env para gerar novos valores.");
  process.exit(1);
}

// hexadecimal: seguro dentro da URL de conexao, sem caracteres a escapar
const valores = {
  "defina-uma-senha": randomBytes(18).toString("hex"),
  "defina-um-segredo-aleatorio": randomBytes(48).toString("hex"),
  "defina-outro-segredo-aleatorio": randomBytes(48).toString("hex"),
};

for (const { modelo, arquivo } of destinos) {
  let conteudo = fs.readFileSync(modelo, "utf8");
  for (const [marcador, valor] of Object.entries(valores)) conteudo = conteudo.split(marcador).join(valor);
  fs.writeFileSync(arquivo, conteudo, { mode: 0o600 });
  console.log(`Criado ${path.relative(raiz, arquivo)}`);
}
