// Trava de seguranca: a suite apaga e recria o banco, entao so aceita um banco
// cujo nome termine em _teste. Evita apagar a base de desenvolvimento por engano.

function exigirBancoDeTeste() {
  const url = process.env.DATABASE_URL_TESTE;
  if (!url) {
    throw new Error("Defina DATABASE_URL_TESTE em servico/.env (veja servico/.env.example).");
  }
  const nomeBanco = new URL(url).pathname.replace(/^\//, "");
  if (!nomeBanco.endsWith("_teste")) {
    throw new Error(`DATABASE_URL_TESTE aponta para "${nomeBanco}", que nao termina em _teste. Recusado.`);
  }
  return url;
}

module.exports = { exigirBancoDeTeste };
