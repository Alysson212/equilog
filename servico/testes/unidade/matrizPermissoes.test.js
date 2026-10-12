// Testes de unidade da matriz de permissoes (especificacao, secao 4; Quadro 8).
// A tabela abaixo e transcrita do documento de forma independente do modulo
// testado: cada uma das 10 operacoes x 4 papeis x 3 acoes e verificada.

const {
  papelPode,
  dominiosLegiveis,
  listarPermissoes,
  listarConcessoes,
  PAPEIS,
  ACOES,
} = require("../../src/dominio/matrizPermissoes");

// Quadro 8, celula por celula. Colunas: proprietario, veterinario, treinador, manejo
const QUADRO_8 = {
  saude:       ["L",     "C,L,E", "L",     "-"],
  manejo:      ["C,L,E", "L",     "L",     "C,L,E"],
  treinamento: ["C,L,E", "L",     "C,L,E", "L"],
  competicao:  ["C,L,E", "-",     "C,L,E", "-"],
  animal:      ["C,L,E", "L",     "L",     "L"],
  acesso:      ["C,L,E", "-",     "-",     "-"],
  anexo:       ["C,L",   "C,L",   "C,L",   "L"],
  lembrete:    ["L,E",   "C,L,E", "L,E",   "L"],
  exportacao:  ["C,L",   "L",     "L",     "-"],
  auditoria:   ["L",     "-",     "-",     "-"],
};

const ORDEM_PAPEIS = ["proprietario", "veterinario", "treinador", "manejo"];
const LETRA = { criar: "C", ler: "L", editar: "E" };

const casos = [];
for (const [operacao, celulas] of Object.entries(QUADRO_8)) {
  ORDEM_PAPEIS.forEach((papel, i) => {
    const permitidas = celulas[i] === "-" ? [] : celulas[i].split(",");
    for (const acao of ACOES) {
      casos.push([operacao, papel, acao, permitidas.includes(LETRA[acao])]);
    }
  });
}

describe("matriz de permissoes (Quadro 8)", () => {
  test("cobre as 10 operacoes, os 4 papeis e as 3 acoes", () => {
    expect(casos).toHaveLength(10 * 4 * 3);
    expect(PAPEIS).toEqual(ORDEM_PAPEIS);
  });

  test.each(casos)("%s / %s / %s => %s", (operacao, papel, acao, esperado) => {
    expect(papelPode(papel, acao, operacao)).toBe(esperado);
  });

  test("decisao de projeto: proprietario apenas le o dominio de saude", () => {
    expect(papelPode("proprietario", "ler", "saude")).toBe(true);
    expect(papelPode("proprietario", "criar", "saude")).toBe(false);
    expect(papelPode("proprietario", "editar", "saude")).toBe(false);
  });

  test("decisao de projeto: manejo nao tem sequer leitura de saude", () => {
    expect(papelPode("manejo", "ler", "saude")).toBe(false);
    expect(dominiosLegiveis("manejo")).not.toContain("saude");
  });

  test("criacao de lembrete cabe apenas ao veterinario", () => {
    expect(ORDEM_PAPEIS.filter((papel) => papelPode(papel, "criar", "lembrete"))).toEqual(["veterinario"]);
  });

  test("papel ou operacao desconhecidos nunca sao autorizados", () => {
    expect(papelPode("administrador", "ler", "saude")).toBe(false);
    expect(papelPode("proprietario", "ler", "financeiro")).toBe(false);
    expect(papelPode("proprietario", "excluir", "animal")).toBe(false);
  });
});

describe("dominios legiveis por papel (UC08)", () => {
  test.each([
    ["proprietario", ["saude", "manejo", "treinamento", "competicao"]],
    ["veterinario", ["saude", "manejo", "treinamento"]],
    ["treinador", ["saude", "manejo", "treinamento", "competicao"]],
    ["manejo", ["manejo", "treinamento"]],
  ])("%s le %j", (papel, esperado) => {
    expect(dominiosLegiveis(papel)).toEqual(esperado);
  });
});

describe("derivacao para as tabelas do seed", () => {
  test("26 permissoes e 56 concessoes, uma por celula da matriz", () => {
    expect(listarPermissoes()).toHaveLength(26);
    expect(listarConcessoes()).toHaveLength(56);
  });

  test("codigos de permissao unicos", () => {
    const codigos = listarPermissoes().map((p) => p.codigo);
    expect(new Set(codigos).size).toBe(codigos.length);
  });
});
