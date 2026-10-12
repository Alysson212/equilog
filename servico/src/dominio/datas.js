// Datas do dominio. Colunas DATE sao representadas como Date a meia-noite UTC
// (convencao do Prisma); a "data corrente" e a do fuso configurado, para que a
// vigencia de um vinculo nao vire de dia as 21h no horario de Brasilia.

const { configuracao } = require("../servicos/configuracao");

function hoje(instante = new Date()) {
  // en-CA formata como AAAA-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: configuracao.fusoHorario,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instante);
}

function paraDataSemHora(textoData) {
  return new Date(`${textoData}T00:00:00.000Z`);
}

function hojeComoData() {
  return paraDataSemHora(hoje());
}

function formatarData(data) {
  return data ? data.toISOString().slice(0, 10) : null;
}

// Data e hora no fuso configurado, com deslocamento explicito,
// no formato do exemplo normativo: 2026-03-14T09:30:00-03:00
function formatarDataHora(instante) {
  if (!instante) return null;
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: configuracao.fusoHorario,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(instante)
      .map((p) => [p.type, p.value]),
  );
  const comoUtc = Date.UTC(partes.year, partes.month - 1, partes.day, partes.hour, partes.minute, partes.second);
  const segundosInteiros = Math.floor(instante.getTime() / 1000) * 1000;
  const minutos = Math.round((comoUtc - segundosInteiros) / 60000);
  const sinal = minutos >= 0 ? "+" : "-";
  const absoluto = Math.abs(minutos);
  const deslocamento = `${sinal}${String(Math.floor(absoluto / 60)).padStart(2, "0")}:${String(absoluto % 60).padStart(2, "0")}`;
  return `${partes.year}-${partes.month}-${partes.day}T${partes.hour}:${partes.minute}:${partes.second}${deslocamento}`;
}

// Primeiro e ultimo instante de um dia (AAAA-MM-DD) no fuso configurado,
// usados nos filtros de periodo da linha do tempo
function limitesDoDia(textoData) {
  const meiaNoiteUtc = new Date(`${textoData}T00:00:00.000Z`);
  const deslocamento = formatarDataHora(meiaNoiteUtc).slice(-6);
  const inicio = new Date(`${textoData}T00:00:00.000${deslocamento}`);
  const fim = new Date(inicio.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { inicio, fim };
}

module.exports = { hoje, hojeComoData, paraDataSemHora, formatarData, formatarDataHora, limitesDoDia };
