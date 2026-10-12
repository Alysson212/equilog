// Trava de seguranca: a suite apaga dados de uso entre os testes, entao so
// aceita o banco cujo nome e exatamente equilog_teste. A verificacao e feita
// na URL configurada e de novo no banco efetivamente conectado.

const NOME_BANCO_TESTE = "equilog_teste";

function exigirBancoDeTeste() {
  const url = process.env.DATABASE_URL_TESTE;
  if (!url) {
    throw new Error("Defina DATABASE_URL_TESTE em servico/.env (veja servico/.env.example).");
  }
  const nomeBanco = new URL(url).pathname.replace(/^\//, "");
  if (nomeBanco !== NOME_BANCO_TESTE) {
    throw new Error(`DATABASE_URL_TESTE aponta para "${nomeBanco}"; a suite so roda em "${NOME_BANCO_TESTE}". Abortado.`);
  }
  return url;
}

// Confere, pela propria conexao, que o banco em uso e o de testes
async function confirmarConexaoDeTeste(prisma) {
  const [{ banco }] = await prisma.$queryRaw`SELECT current_database() AS banco`;
  if (banco !== NOME_BANCO_TESTE) {
    throw new Error(`Conectado ao banco "${banco}", e nao a "${NOME_BANCO_TESTE}". Abortado.`);
  }
}

module.exports = { exigirBancoDeTeste, confirmarConexaoDeTeste, NOME_BANCO_TESTE };
