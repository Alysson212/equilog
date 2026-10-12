// Autorizacao no servidor: CT05, CT07 e CT08 (RNF03, RF07, RNF04).

const { randomUUID } = require("node:crypto");
const {
  api,
  prisma,
  limparBase,
  montarCenario,
  criarUsuario,
  conceder,
  registrosDeAuditoria,
  encerrar,
} = require("./apoio");

beforeEach(limparBase);
afterAll(encerrar);

function eventoCompeticao() {
  return {
    id: randomUUID(),
    dominio: "competicao",
    tipoEvento: "prova oficial",
    dataEvento: "2026-03-14T09:30:00-03:00",
    titulo: "Prova de tres tambores",
    detalhe: { nomeProva: "Copa Regional" },
  };
}

function eventoSaude() {
  return {
    id: randomUUID(),
    dominio: "saude",
    tipoEvento: "vacinacao",
    dataEvento: "2026-03-14T09:30:00-03:00",
    titulo: "Vacinacao contra influenza equina",
    detalhe: { procedimento: "vacinacao" },
  };
}

describe("CT05 - veterinario tenta registrar evento de competicao (RF12, RNF03)", () => {
  test("responde 403 e registra a negacao por papel insuficiente", async () => {
    const { veterinario, animal } = await montarCenario();

    const resposta = await api(veterinario.token).post(`/animais/${animal.id}/eventos`).send(eventoCompeticao());

    expect(resposta.status).toBe(403);
    expect(resposta.body).toEqual({ erro: "Seu papel neste animal não permite esta operação." });

    const negacoes = await registrosDeAuditoria({ acao: "acesso_negado", usuarioId: veterinario.id });
    expect(negacoes).toHaveLength(1);
    expect(negacoes[0]).toMatchObject({
      entidade: "competicao",
      entidadeId: animal.id,
      motivo: "papel_insuficiente",
    });
  });
});

describe("CT07 - requisicao direta ao servico sem o cliente oficial (RNF03)", () => {
  // O aplicativo esconde do responsavel pelo manejo a opcao de registrar saude,
  // mas a decisao e do servidor: a mesma requisicao forjada fora do aplicativo
  // recebe a mesma recusa, independentemente de cabecalhos de cliente.
  const CLIENTES = [
    { "User-Agent": "EquiLog-Android/1.0", "X-Cliente": "aplicativo-oficial" },
    { "User-Agent": "curl/8.9.1" },
    {},
  ];

  test("mesma recusa para operacao fora do papel, qualquer que seja o cliente", async () => {
    const { manejo, animal } = await montarCenario();

    const respostas = [];
    for (const cabecalhos of CLIENTES) {
      respostas.push(await api(manejo.token).post(`/animais/${animal.id}/eventos`).set(cabecalhos).send(eventoSaude()));
    }

    for (const resposta of respostas) {
      expect(resposta.status).toBe(403);
      expect(resposta.body).toEqual(respostas[0].body);
    }
    const negacoes = await registrosDeAuditoria({ usuarioId: manejo.id, motivo: "papel_insuficiente" });
    expect(negacoes).toHaveLength(CLIENTES.length);
  });

  test("mesma recusa para usuario sem vinculo com o animal", async () => {
    const { animal } = await montarCenario();
    const estranho = await criarUsuario("Estranho");

    for (const cabecalhos of CLIENTES) {
      const resposta = await api(estranho.token).get(`/animais/${animal.id}`).set(cabecalhos);
      expect(resposta.status).toBe(403);
      expect(resposta.body).toEqual({ erro: "Você não tem acesso a este animal." });
    }
    const negacoes = await registrosDeAuditoria({ usuarioId: estranho.id, motivo: "sem_vinculo" });
    expect(negacoes).toHaveLength(CLIENTES.length);
  });

  test("operacao administrativa do proprietario e recusada aos demais papeis", async () => {
    const { veterinario, treinador, animal } = await montarCenario();
    const terceiro = await criarUsuario("Terceiro");

    for (const usuario of [veterinario, treinador]) {
      const concessao = await api(usuario.token)
        .post(`/animais/${animal.id}/acessos`)
        .set("User-Agent", "curl/8.9.1")
        .send({ email: terceiro.email, papel: "treinador" });
      expect(concessao.status).toBe(403);

      const edicao = await api(usuario.token).patch(`/animais/${animal.id}`).send({ nome: "Outro nome" });
      expect(edicao.status).toBe(403);
    }
  });
});

describe("CT08 - acesso apos revogacao do vinculo (RF07)", () => {
  test("recusa imediata com o mesmo token, sem aguardar a expiracao", async () => {
    const { proprietario, treinador, animal } = await montarCenario();

    const antes = await api(treinador.token).get(`/animais/${animal.id}`);
    expect(antes.status).toBe(200);
    expect(antes.body.papel).toBe("treinador");

    const vinculos = await api(treinador.token).get("/animais");
    expect(vinculos.body.itens.map((a) => a.id)).toContain(animal.id);

    const vinculo = await prisma.vinculoAcesso.findFirst({ where: { usuarioId: treinador.id, animalId: animal.id } });
    const revogacao = await api(proprietario.token).delete(`/acessos/${vinculo.id}`);
    expect(revogacao.status).toBe(204);

    // o mesmo token de acesso, ainda dentro dos 15 minutos de validade
    const depois = await api(treinador.token).get(`/animais/${animal.id}`);
    expect(depois.status).toBe(403);
    expect(depois.body).toEqual({ erro: "Você não tem acesso a este animal." });

    const lista = await api(treinador.token).get("/animais");
    expect(lista.body.itens.map((a) => a.id)).not.toContain(animal.id);

    const revogacoes = await registrosDeAuditoria({ acao: "acesso_revogado", entidadeId: vinculo.id });
    expect(revogacoes).toHaveLength(1);
    const negacao = await registrosDeAuditoria({ usuarioId: treinador.id, motivo: "sem_vinculo" });
    expect(negacao).toHaveLength(1);
  });

  test("vinculo com vigencia encerrada tambem e recusado", async () => {
    const { proprietario, animal } = await montarCenario();
    const temporario = await criarUsuario("Temporario");
    await conceder(proprietario, animal.id, temporario, "veterinario", { dataInicio: "2025-01-01", dataFim: "2025-01-31" });

    const resposta = await api(temporario.token).get(`/animais/${animal.id}`);
    expect(resposta.status).toBe(403);
  });
});
