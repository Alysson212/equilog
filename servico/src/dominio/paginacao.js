// Parametros de paginacao das listagens (limite e deslocamento).

const { validarCampo } = require("./validacao");

const LIMITE_PADRAO = 50;
const LIMITE_MAXIMO = 100;

// Le limite e deslocamento da query string, acumulando erros em `erros`
function lerPaginacao(consulta, erros) {
  const paginacao = { limite: LIMITE_PADRAO, deslocamento: 0 };
  for (const [campo, rotulo, minimo, maximo] of [
    ["limite", "o limite", 1, LIMITE_MAXIMO],
    ["deslocamento", "o deslocamento", 0, undefined],
  ]) {
    if (consulta[campo] === undefined) continue;
    const resultado = validarCampo(String(consulta[campo]), { tipo: "inteiro", minimo, rotulo });
    if (resultado.mensagem) erros.push({ campo, mensagem: resultado.mensagem });
    else if (maximo !== undefined && resultado.valor > maximo) {
      erros.push({ campo, mensagem: `O limite deve ser no máximo ${maximo}.` });
    } else paginacao[campo] = resultado.valor;
  }
  return paginacao;
}

module.exports = { lerPaginacao };
