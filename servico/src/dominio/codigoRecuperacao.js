// Codigo de recuperacao de senha (decisao 9.7 da especificacao): 12 simbolos
// de um alfabeto sem caracteres ambiguos (sem 0/O, 1/I/L), exibido em grupos
// de quatro. Cerca de 59 bits de entropia, gerados com crypto.randomInt.

const { randomInt } = require("node:crypto");

const ALFABETO = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const TAMANHO = 12;

function gerarCodigo() {
  let codigo = "";
  for (let i = 0; i < TAMANHO; i += 1) codigo += ALFABETO[randomInt(ALFABETO.length)];
  return codigo.match(/.{4}/g).join("-");
}

// Aceita o codigo como a pessoa digitou: minusculas, espacos e hifens
function normalizarCodigo(texto) {
  return String(texto).toUpperCase().replace(/[\s-]/g, "");
}

module.exports = { gerarCodigo, normalizarCodigo, TAMANHO };
