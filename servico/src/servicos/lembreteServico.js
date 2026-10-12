// Lembretes (RF18, RF19). O lembrete nasce somente da data de retorno digitada
// por uma pessoa em um evento de saude (RF17, em eventoServico). Aqui ele e
// listado para agendamento da notificacao no dispositivo e tem seu estado
// alterado. Nenhuma data e calculada, sugerida ou proposta (RNF11).

const lembreteRepo = require("../repositorios/lembreteRepo");
const vinculoRepo = require("../repositorios/vinculoRepo");
const { emTransacao } = require("../repositorios/prisma");
const auditoria = require("./auditoriaServico");
const { papelPode } = require("../dominio/matrizPermissoes");
const { falhaDeValidacao } = require("../dominio/erros");
const { formatarData, paraDataSemHora } = require("../dominio/datas");
const { validarObjeto, exigirObjeto, lancarSeHouverErros } = require("../dominio/validacao");

const ESTADOS = ["pendente", "cumprido", "adiado", "cancelado"];

// O lembrete deriva de um evento de saude. O papel que nao le saude (manejo)
// ve o lembrete e a data, mas nao o evento que o originou.
function paraRepresentacao(lembrete, papel) {
  const evento = lembrete.evento;
  const podeVerEvento = papelPode(papel, "ler", evento.tipoEvento.dominio);
  return {
    id: lembrete.id,
    animal: { id: lembrete.animal.id, nome: lembrete.animal.nome },
    dataPrevista: formatarData(lembrete.dataPrevista),
    status: lembrete.status,
    papel,
    evento: podeVerEvento ? { id: evento.id, titulo: evento.titulo, tipoEvento: evento.tipoEvento.nome } : null,
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

  const vinculos = await vinculoRepo.listarVigentesDoUsuario(usuarioId);
  const papelPorAnimal = new Map(
    vinculos.filter((v) => papelPode(v.papel.nome, "ler", "lembrete")).map((v) => [v.animalId, v.papel.nome]),
  );
  if (papelPorAnimal.size === 0) return [];

  const lembretes = await lembreteRepo.listarDosAnimais([...papelPorAnimal.keys()], { status });
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
