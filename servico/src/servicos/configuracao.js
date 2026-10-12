// Parametros do servico lidos do ambiente. Segredos nunca tem valor padrao:
// a ausencia e erro de configuracao e interrompe a operacao que depende deles.

function exigir(nome) {
  const valor = process.env[nome];
  if (!valor) {
    throw new Error(`Variavel de ambiente obrigatoria ausente: ${nome}`);
  }
  return valor;
}

const configuracao = {
  get segredoAcesso() {
    return exigir("JWT_SEGREDO_ACESSO");
  },
  get segredoRenovacao() {
    return exigir("JWT_SEGREDO_RENOVACAO");
  },
  // validades fixadas na especificacao (secao 10, stack)
  validadeAcesso: "15m",
  validadeRenovacao: "30d",
  custoBcrypt: 12,
  get fusoHorario() {
    return process.env.FUSO_HORARIO ?? "America/Sao_Paulo";
  },
  get diretorioAnexos() {
    return process.env.DIRETORIO_ANEXOS ?? "armazenamento/anexos";
  },
  tamanhoMaximoAnexo: 10 * 1024 * 1024,
};

module.exports = { configuracao };
