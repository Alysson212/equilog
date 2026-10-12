// Tipos de arquivo aceitos como anexo (RF20: imagem ou documento).
// O tipo e identificado pela assinatura do conteudo, nao pelo nome nem pelo
// tipo declarado pelo cliente.

const TIPOS = [
  { mime: "image/jpeg", extensao: ".jpg", confere: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    mime: "image/png",
    extensao: ".png",
    confere: (b) => b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    mime: "image/webp",
    extensao: ".webp",
    confere: (b) => b.length > 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP",
  },
  { mime: "application/pdf", extensao: ".pdf", confere: (b) => b.length > 5 && b.toString("ascii", 0, 5) === "%PDF-" },
];

function identificarTipo(conteudo) {
  return TIPOS.find((tipo) => tipo.confere(conteudo)) ?? null;
}

module.exports = { identificarTipo };
