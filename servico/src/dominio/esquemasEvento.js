// Esquema dos eventos por dominio (especificacao, secao 3; RF09 a RF12).
// Atributos comuns ficam em evento; os especificos, na tabela do subtipo, onde
// o atributo principal de cada dominio e obrigatorio.
//
// RNF07: campos obrigatorios digitados pelo usuario em um evento de rotina sao
// tipoEvento, dataEvento, titulo e o atributo principal do subtipo (quatro);
// id e dominio sao definidos pelo aplicativo.

const CAMPOS_COMUNS = {
  id: { tipo: "uuid", obrigatorio: true, rotulo: "o identificador do registro" },
  tipoEvento: { tipo: "texto", obrigatorio: true, max: 60, rotulo: "o tipo de registro" },
  dataEvento: { tipo: "dataHora", obrigatorio: true, rotulo: "a data do registro" },
  titulo: { tipo: "texto", obrigatorio: true, max: 140, rotulo: "o título" },
  observacao: { tipo: "texto", rotulo: "a observação" },
};

// relacao: nome da relacao do subtipo no modelo Evento do Prisma
const ESQUEMAS_DOMINIO = {
  saude: {
    relacao: "saude",
    campos: {
      procedimento: { tipo: "texto", obrigatorio: true, max: 80, rotulo: "o procedimento" },
      produto: { tipo: "texto", max: 120, rotulo: "o produto" },
      dose: { tipo: "texto", max: 40, rotulo: "a dose" },
      via: { tipo: "texto", max: 40, rotulo: "a via de aplicação" },
      profissional: { tipo: "texto", max: 120, rotulo: "o profissional" },
      dataRetorno: { tipo: "data", rotulo: "a data de retorno" },
    },
  },
  manejo: {
    relacao: "manejo",
    campos: {
      categoria: { tipo: "texto", obrigatorio: true, max: 60, rotulo: "a categoria" },
      descricao: { tipo: "texto", max: 200, rotulo: "a descrição" },
      quantidade: { tipo: "decimal", digitos: 8, casas: 2, minimo: 0, rotulo: "a quantidade" },
      unidade: { tipo: "texto", max: 12, rotulo: "a unidade" },
    },
  },
  treinamento: {
    relacao: "treinamento",
    campos: {
      tipoExercicio: { tipo: "texto", obrigatorio: true, max: 60, rotulo: "o tipo de exercício" },
      duracaoMin: { tipo: "inteiro", minimo: 0, rotulo: "a duração em minutos" },
      intensidade: { tipo: "texto", max: 20, rotulo: "a intensidade" },
      piso: { tipo: "texto", max: 40, rotulo: "o piso" },
    },
  },
  competicao: {
    relacao: "competicao",
    campos: {
      nomeProva: { tipo: "texto", obrigatorio: true, max: 140, rotulo: "o nome da prova" },
      local: { tipo: "texto", max: 140, rotulo: "o local" },
      categoria: { tipo: "texto", max: 60, rotulo: "a categoria" },
      tempoSegundos: { tipo: "decimal", digitos: 6, casas: 3, minimo: 0, rotulo: "o tempo" },
      colocacao: { tipo: "inteiro", minimo: 1, rotulo: "a colocação" },
      penalidade: { tipo: "decimal", digitos: 6, casas: 3, minimo: 0, rotulo: "a penalidade" },
    },
  },
};

const RELACOES_SUBTIPO = Object.values(ESQUEMAS_DOMINIO).map((e) => e.relacao);

module.exports = { CAMPOS_COMUNS, ESQUEMAS_DOMINIO, RELACOES_SUBTIPO };
