// Lembretes (RF18, RF19). O lembrete nasce somente da data de retorno digitada
// por uma pessoa em um evento de saude (RF17, em eventoServico). Aqui ele e
// listado para agendamento da notificacao no dispositivo e tem seu estado
// alterado. Nenhuma data e calculada, sugerida ou proposta (RNF11).
//
// Visibilidade: o lembrete herda a do evento que o originou. Quem nao le o
// dominio do evento de origem nao ve o lembrete, nem em contagem (UC08).

const lembreteRepo = require("../repositorios/lembreteRepo");
const vinculoRepo = require("../repositorios/vinculoRepo");
const { emTransacao } = require("../repositorios/prisma");
const auditoria = require("./auditoriaServico");
const { papelPode, dominiosLegiveis } = require("../dominio/matrizPermissoes");
const { falhaDeValidacao } = require("../dominio/erros");
const { formatarData, paraDataSemHora } = require("../dominio/datas");
const { validarObjeto, exigirObjeto, lancarSeHouverErros } = require("../dominio/validacao");

const ESTADOS = ["pendente", "cumprido", "adiado", "cancelado"];

function paraRepresentacao(lembrete, papel) {
  const evento = lembrete.evento;
  return {
    id: lembrete.id,
    animal: { id: lembrete.animal.id, nome: lembrete.animal.nome },
    dataPrevista: formatarData(lembrete.dataPrevista),
    status: lembrete.status,
    papel,
    evento: { id: evento.id, titulo: evento.titulo, tipoEvento: evento.tipoEvento.nome },
  };
}

async function listar(usuarioId, consulta) {
  let status = null;
  if (consulta.status !== undefined) {
    if (!ESTADOS.includes(consulta.status)) {
      throw falhaDeValidacao([{ campo: "status", mensagem: "Filtre por pendente, cumprido, adiado ou cancelado." }]);
    }
    status = consulta.status;
  }

  // animais agrupados por papel, cada grupo com os dominios que o papel le
  const vinculos = await vinculoRepo.listarVigentesDoUsuario(usuarioId);
  const papelPorAnimal = new Map();
  const animaisPorPapel = new Map();
  for (const vinculo of vinculos) {
    const papel = vinculo.papel.nome;
    if (!papelPode(papel, "ler", "lembrete")) continue;
    papelPorAnimal.set(vinculo.animalId, papel);
    animaisPorPapel.set(papel, [...(animaisPorPapel.get(papel) ?? []), vinculo.animalId]);
  }
  const escopos = [...animaisPorPapel.entries()]
    .map(([papel, animalIds]) => ({ animalIds, dominios: dominiosLegiveis(papel) }))
    .filter((escopo) => escopo.dominios.length > 0);
  if (escopos.length === 0) return [];

  const lembretes = await lembreteRepo.listarVisiveis(escopos, { status });
  return lembretes.map((l) => paraRepresentacao(l, papelPorAnimal.get(l.animalId)));
}

const REGRAS_ALTERACAO = {
  status: {
    tipo: "opcao",
    obrigatorio: true,
    valores: ["cumprido", "adiado", "cancelado"],
    rotulo: "a situação",
    mensagemOpcao: "Marque o lembrete como cumprido, adiado ou cancelado.",
  },
  dataPrevista: { tipo: "data", rotulo: "a nova data" },
};

// RF19: E na matriz significa alterar o estado para cumprido, adiado ou
// cancelado. Ao adiar, a pessoa pode informar a nova data.
async function alterarEstado(contexto, vinculo, lembrete, corpo) {
  const { valores, erros } = validarObjeto(exigirObjeto(corpo), REGRAS_ALTERACAO);
  if (valores.dataPrevista && valores.status !== "adiado") {
    erros.push({ campo: "dataPrevista", mensagem: "A nova data só pode ser informada ao adiar o lembrete." });
  }
  lancarSeHouverErros(erros);

  const dados = { status: valores.status };
  if (valores.dataPrevista) dados.dataPrevista = paraDataSemHora(valores.dataPrevista);

  await emTransacao(async (tx) => {
    await lembreteRepo.atualizar(lembrete.id, dados, tx);
    await auditoria.registrar(
      {
        usuarioId: contexto.usuarioId,
        acao: `lembrete_${valores.status}`,
        entidade: "lembrete",
        entidadeId: lembrete.id,
        enderecoIp: contexto.enderecoIp,
      },
      tx,
    );
  });

  return paraRepresentacao(await lembreteRepo.buscarPorId(lembrete.id), vinculo.papel);
}

module.exports = { listar, alterarEstado };
