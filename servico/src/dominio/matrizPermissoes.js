// Matriz de permissoes por papel (especificacao, secao 4; Quadro 8 do TCC).
// Unica fonte da matriz no codigo: o seed deriva dela as tabelas permissao e
// papel_permissao, e o middleware de autorizacao a consulta a cada requisicao.

const PAPEIS = ["proprietario", "veterinario", "treinador", "manejo"];

const ACOES = ["criar", "ler", "editar"];

// Operacoes da matriz. As quatro primeiras sao os dominios de evento.
const OPERACOES = {
  saude: "evento de saúde",
  manejo: "evento de manejo",
  treinamento: "evento de treinamento",
  competicao: "evento de competição",
  animal: "cadastro do animal",
  acesso: "concessão e revogação de acesso",
  anexo: "anexo de documento a evento",
  lembrete: "lembretes do animal",
  exportacao: "exportação do histórico",
  auditoria: "trilha de auditoria do animal",
};

const DOMINIOS_EVENTO = ["saude", "manejo", "treinamento", "competicao"];

const C = "criar";
const L = "ler";
const E = "editar";

// Transcricao literal da matriz: operacao -> papel -> acoes permitidas.
const MATRIZ = {
  saude:       { proprietario: [L],       veterinario: [C, L, E], treinador: [L],       manejo: [] },
  manejo:      { proprietario: [C, L, E], veterinario: [L],       treinador: [L],       manejo: [C, L, E] },
  treinamento: { proprietario: [C, L, E], veterinario: [L],       treinador: [C, L, E], manejo: [L] },
  competicao:  { proprietario: [C, L, E], veterinario: [],        treinador: [C, L, E], manejo: [] },
  animal:      { proprietario: [C, L, E], veterinario: [L],       treinador: [L],       manejo: [L] },
  acesso:      { proprietario: [C, L, E], veterinario: [],        treinador: [],        manejo: [] },
  anexo:       { proprietario: [C, L],    veterinario: [C, L],    treinador: [C, L],    manejo: [L] },
  lembrete:    { proprietario: [L, E],    veterinario: [C, L, E], treinador: [L, E],    manejo: [L] },
  exportacao:  { proprietario: [C, L],    veterinario: [L],       treinador: [L],       manejo: [] },
  auditoria:   { proprietario: [L],       veterinario: [],        treinador: [],        manejo: [] },
};

function codigoPermissao(operacao, acao) {
  return `${operacao}.${acao}`;
}

function papelPode(papel, acao, operacao) {
  const linha = MATRIZ[operacao];
  if (!linha || !linha[papel]) return false;
  return linha[papel].includes(acao);
}

function dominiosLegiveis(papel) {
  return DOMINIOS_EVENTO.filter((dominio) => papelPode(papel, L, dominio));
}

// Lista de permissoes existentes (toda combinacao operacao x acao concedida a
// pelo menos um papel), usada pelo seed da tabela permissao.
function listarPermissoes() {
  const verbos = { criar: "Criar", ler: "Ler", editar: "Editar" };
  const lista = [];
  for (const operacao of Object.keys(MATRIZ)) {
    for (const acao of ACOES) {
      const concedida = PAPEIS.some((papel) => papelPode(papel, acao, operacao));
      if (concedida) {
        lista.push({
          codigo: codigoPermissao(operacao, acao),
          descricao: `${verbos[acao]} ${OPERACOES[operacao]}`,
        });
      }
    }
  }
  return lista;
}

// Pares (papel, codigo de permissao), usados pelo seed de papel_permissao.
function listarConcessoes() {
  const pares = [];
  for (const operacao of Object.keys(MATRIZ)) {
    for (const papel of PAPEIS) {
      for (const acao of MATRIZ[operacao][papel]) {
        pares.push({ papel, codigo: codigoPermissao(operacao, acao) });
      }
    }
  }
  return pares;
}

module.exports = {
  PAPEIS,
  ACOES,
  OPERACOES,
  DOMINIOS_EVENTO,
  MATRIZ,
  codigoPermissao,
  papelPode,
  dominiosLegiveis,
  listarPermissoes,
  listarConcessoes,
};
