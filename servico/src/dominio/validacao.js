// Validacao de campos com mensagens em linguagem comum (RNF08).
// Cada regra descreve tipo, obrigatoriedade e limites; o rotulo traz o artigo
// ("o titulo", "a data do evento") para compor frases naturais.

const { falhaDeValidacao, requisicaoMalformada } = require("./erros");

const PADRAO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PADRAO_DATA = /^\d{4}-\d{2}-\d{2}$/;
const PADRAO_DATA_HORA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:\d{2})$/;
const PADRAO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function maiuscula(texto) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function vazio(valor) {
  return valor === undefined || valor === null || (typeof valor === "string" && valor.trim() === "");
}

function dataValida(texto) {
  if (!PADRAO_DATA.test(texto)) return false;
  const data = new Date(`${texto}T00:00:00.000Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === texto;
}

function converterDecimal(valor, regra) {
  const texto = typeof valor === "number" ? String(valor) : valor;
  if (typeof texto !== "string" || !/^-?\d+(\.\d+)?$/.test(texto.trim())) return { erro: "numero" };
  const [inteira, fracao = ""] = texto.trim().replace("-", "").split(".");
  if (fracao.length > regra.casas) return { erro: "casas" };
  if (inteira.replace(/^0+/, "").length > regra.digitos - regra.casas) return { erro: "grande" };
  const numero = Number(texto);
  if (regra.minimo !== undefined && numero < regra.minimo) return { erro: "minimo" };
  return { valor: numero };
}

// Valida um campo e devolve { valor } normalizado ou { mensagem } de erro.
function validarCampo(valor, regra) {
  const rotulo = regra.rotulo;

  if (vazio(valor)) {
    return regra.obrigatorio ? { mensagem: `Informe ${rotulo}.` } : { valor: null };
  }

  switch (regra.tipo) {
    case "texto": {
      if (typeof valor !== "string") return { mensagem: `${maiuscula(rotulo)} deve ser um texto.` };
      const texto = valor.trim();
      if (regra.max && texto.length > regra.max) {
        return { mensagem: `${maiuscula(rotulo)} deve ter no máximo ${regra.max} caracteres.` };
      }
      if (regra.min && texto.length < regra.min) {
        return { mensagem: `${maiuscula(rotulo)} deve ter pelo menos ${regra.min} caracteres.` };
      }
      return { valor: texto };
    }
    case "senha": {
      if (typeof valor !== "string") return { mensagem: `${maiuscula(rotulo)} deve ser um texto.` };
      if (valor.length < regra.min) return { mensagem: `${maiuscula(rotulo)} deve ter pelo menos ${regra.min} caracteres.` };
      if (Buffer.byteLength(valor, "utf8") > regra.max) {
        return { mensagem: `${maiuscula(rotulo)} deve ter no máximo ${regra.max} caracteres.` };
      }
      return { valor };
    }
    case "email": {
      if (typeof valor !== "string" || !PADRAO_EMAIL.test(valor.trim()) || valor.trim().length > regra.max) {
        return { mensagem: `Informe um e-mail válido.` };
      }
      return { valor: valor.trim().toLowerCase() };
    }
    case "uuid": {
      if (typeof valor !== "string" || !PADRAO_UUID.test(valor)) {
        return { mensagem: `${maiuscula(rotulo)} não está em um formato válido.` };
      }
      return { valor: valor.toLowerCase() };
    }
    case "data": {
      if (typeof valor !== "string" || !dataValida(valor)) {
        return { mensagem: `${maiuscula(rotulo)} deve ser uma data válida no formato AAAA-MM-DD.` };
      }
      return { valor };
    }
    case "dataHora": {
      const data = typeof valor === "string" && PADRAO_DATA_HORA.test(valor) ? new Date(valor) : null;
      if (!data || Number.isNaN(data.getTime()) || !dataValida(valor.slice(0, 10))) {
        return { mensagem: `${maiuscula(rotulo)} deve ser uma data e hora válidas.` };
      }
      return { valor: data };
    }
    case "inteiro": {
      const numero = typeof valor === "string" && /^-?\d+$/.test(valor.trim()) ? Number(valor) : valor;
      if (!Number.isInteger(numero) || Math.abs(numero) > 2147483647) {
        return { mensagem: `${maiuscula(rotulo)} deve ser um número inteiro.` };
      }
      if (regra.minimo !== undefined && numero < regra.minimo) {
        return { mensagem: `${maiuscula(rotulo)} deve ser maior ou igual a ${regra.minimo}.` };
      }
      return { valor: numero };
    }
    case "decimal": {
      const resultado = converterDecimal(valor, regra);
      const mensagens = {
        numero: `${maiuscula(rotulo)} deve ser um número.`,
        casas: `${maiuscula(rotulo)} aceita no máximo ${regra.casas} casas decimais.`,
        grande: `${maiuscula(rotulo)} está acima do valor permitido.`,
        minimo: `${maiuscula(rotulo)} deve ser maior ou igual a ${regra.minimo}.`,
      };
      return resultado.erro ? { mensagem: mensagens[resultado.erro] } : resultado;
    }
    case "opcao": {
      if (!regra.valores.includes(valor)) return { mensagem: regra.mensagemOpcao };
      return { valor };
    }
    case "booleano": {
      if (typeof valor !== "boolean") return { mensagem: `${maiuscula(rotulo)} deve ser verdadeiro ou falso.` };
      return { valor };
    }
    default:
      throw new Error(`Tipo de regra desconhecido: ${regra.tipo}`);
  }
}

// Valida um objeto contra um conjunto de regras.
// opcoes.parcial: valida apenas os campos presentes (edicao).
// prefixo: nome do objeto pai nas mensagens de campo (ex.: "detalhe").
function validarObjeto(dados, regras, { parcial = false, prefixo = "" } = {}) {
  const valores = {};
  const erros = [];
  for (const [campo, regra] of Object.entries(regras)) {
    const presente = Object.prototype.hasOwnProperty.call(dados, campo);
    if (parcial && !presente) continue;
    const resultado = validarCampo(dados[campo], regra);
    if (resultado.mensagem) {
      erros.push({ campo: prefixo ? `${prefixo}.${campo}` : campo, mensagem: resultado.mensagem });
    } else {
      valores[campo] = resultado.valor;
    }
  }
  return { valores, erros };
}

// Exige que o corpo seja um objeto JSON; outra coisa e requisicao malformada (400).
function exigirObjeto(corpo) {
  if (corpo === null || typeof corpo !== "object" || Array.isArray(corpo)) {
    throw requisicaoMalformada();
  }
  return corpo;
}

// Lanca 422 se houver erros acumulados.
function lancarSeHouverErros(erros) {
  if (erros.length > 0) throw falhaDeValidacao(erros);
}

module.exports = {
  validarCampo,
  validarObjeto,
  exigirObjeto,
  lancarSeHouverErros,
  PADRAO_UUID,
};
