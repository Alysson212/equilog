// Exportacao do historico do animal em PDF (RF22).
// O conteudo segue a mesma regra da linha do tempo (UC08): apenas eventos nao
// excluidos dos dominios que o papel pode ler. O documento apenas transcreve o
// que foi registrado por pessoas, sem resumo, interpretacao ou recomendacao
// (RNF11).

const PDFDocument = require("pdfkit");
const animalRepo = require("../repositorios/animalRepo");
const eventoRepo = require("../repositorios/eventoRepo");
const auditoria = require("./auditoriaServico");
const { paraItem } = require("./representacaoEvento");
const { dominiosLegiveis } = require("../dominio/matrizPermissoes");
const { formatarData, formatarDataHora } = require("../dominio/datas");
const { naoEncontrado } = require("../dominio/erros");

const NOMES_DOMINIO = { saude: "Saúde", manejo: "Manejo", treinamento: "Treinamento", competicao: "Competição" };
const NOMES_PAPEL = {
  proprietario: "proprietário",
  veterinario: "veterinário",
  treinador: "treinador",
  manejo: "responsável pelo manejo",
};
const NOMES_SEXO = { M: "macho", F: "fêmea", C: "macho castrado" };
const ROTULOS_DETALHE = {
  procedimento: "Procedimento",
  produto: "Produto",
  dose: "Dose",
  via: "Via",
  profissional: "Profissional",
  dataRetorno: "Data de retorno",
  categoria: "Categoria",
  descricao: "Descrição",
  quantidade: "Quantidade",
  unidade: "Unidade",
  tipoExercicio: "Tipo de exercício",
  duracaoMin: "Duração (min)",
  intensidade: "Intensidade",
  piso: "Piso",
  nomeProva: "Prova",
  local: "Local",
  tempoSegundos: "Tempo (s)",
  colocacao: "Colocação",
  penalidade: "Penalidade",
};
const LIMITE_EVENTOS = 10000;

// Dados do historico visiveis ao papel, em ordem cronologica decrescente
async function montarHistorico(vinculo, animalId) {
  const animal = await animalRepo.buscarPorId(animalId);
  if (!animal) throw naoEncontrado();
  const dominios = dominiosLegiveis(vinculo.papel);
  const { itens } = await eventoRepo.listarLinhaDoTempo(
    { animalId, excluidoEm: null, tipoEvento: { dominio: { in: dominios } } },
    { limite: LIMITE_EVENTOS, deslocamento: 0 },
  );
  return {
    animal: {
      nome: animal.nome,
      registroAssociacao: animal.registroAssociacao,
      dataNascimento: formatarData(animal.dataNascimento),
      sexo: animal.sexo,
      pelagem: animal.pelagem,
    },
    papel: vinculo.papel,
    dominios,
    geradoEm: formatarDataHora(new Date()),
    eventos: itens.map(paraItem),
  };
}

function exibirDataHora(texto) {
  // 2026-03-14T09:30:00-03:00 -> 14/03/2026 09:30
  return `${texto.slice(8, 10)}/${texto.slice(5, 7)}/${texto.slice(0, 4)} ${texto.slice(11, 16)}`;
}

function exibirData(texto) {
  return texto ? `${texto.slice(8, 10)}/${texto.slice(5, 7)}/${texto.slice(0, 4)}` : null;
}

function gerarPdf(historico) {
  return new Promise((resolve, reject) => {
    const documento = new PDFDocument({ size: "A4", margin: 50, info: { Title: `Histórico de ${historico.animal.nome}`, Creator: "EquiLog" } });
    const partes = [];
    documento.on("data", (parte) => partes.push(parte));
    documento.on("end", () => resolve(Buffer.concat(partes)));
    documento.on("error", reject);

    const { animal } = historico;
    documento.font("Helvetica-Bold").fontSize(16).text(`Histórico de ${animal.nome}`);
    documento.font("Helvetica").fontSize(9).fillColor("#555555");
    documento.text(`Gerado pelo EquiLog em ${exibirDataHora(historico.geradoEm)}, com a visão do papel ${NOMES_PAPEL[historico.papel]}.`);
    documento.text(`Domínios incluídos: ${historico.dominios.map((d) => NOMES_DOMINIO[d]).join(", ")}.`);
    documento.moveDown(0.5).fillColor("#000000").fontSize(10);
    const dadosAnimal = [
      ["Registro", animal.registroAssociacao],
      ["Nascimento", exibirData(animal.dataNascimento)],
      ["Sexo", NOMES_SEXO[animal.sexo]],
      ["Pelagem", animal.pelagem],
    ].filter(([, valor]) => valor);
    for (const [rotulo, valor] of dadosAnimal) documento.text(`${rotulo}: ${valor}`);
    documento.moveDown();

    if (historico.eventos.length === 0) {
      documento.text("Nenhum registro disponível.");
    }
    for (const evento of historico.eventos) {
      documento.font("Helvetica-Bold").fontSize(10)
        .text(`${exibirDataHora(evento.dataEvento)}  ·  ${NOMES_DOMINIO[evento.dominio]}  ·  ${evento.titulo}`);
      documento.font("Helvetica").fontSize(9);
      documento.text(`Tipo: ${evento.tipoEvento}. Registrado por ${evento.registradoPor.nome}.`);
      const detalhes = Object.entries(evento.detalhe ?? {})
        .filter(([, valor]) => valor !== null)
        .map(([campo, valor]) => `${ROTULOS_DETALHE[campo] ?? campo}: ${campo === "dataRetorno" ? exibirData(valor) : valor}`);
      if (detalhes.length > 0) documento.text(detalhes.join("  ·  "));
      if (evento.observacao) documento.text(`Observação: ${evento.observacao}`);
      documento.moveDown(0.6);
    }
    documento.end();
  });
}

function nomeDoArquivo(nomeAnimal) {
  const base = nomeAnimal
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return `historico-${base || "animal"}.pdf`;
}

async function exportar(contexto, vinculo, animalId) {
  const historico = await montarHistorico(vinculo, animalId);
  const pdf = await gerarPdf(historico);
  await auditoria.registrar({
    usuarioId: contexto.usuarioId,
    acao: "historico_exportado",
    entidade: "animal",
    entidadeId: animalId,
    enderecoIp: contexto.enderecoIp,
  });
  return { pdf, nomeArquivo: nomeDoArquivo(historico.animal.nome) };
}

module.exports = { exportar, montarHistorico };
