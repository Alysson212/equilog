// Animais (RF04, RF05, RF08) e concessao de acesso (RF06, UC03).

const { api, prisma, limparBase, criarUsuario, criarAnimal, conceder, registrosDeAuditoria, encerrar } = require("./apoio");

beforeEach(limparBase);
afterAll(encerrar);

describe("cadastro de animal (RF04; decisoes 9.1 e 9.2)", () => {
  test("quem cria vira proprietario, com vinculo de vigencia aberta na mesma transacao", async () => {
    const dono = await criarUsuario("Dono");
    const resposta = await api(dono.token).post("/animais").send({
      nome: "Relampago",
      registroAssociacao: "ABQM-12345",
      dataNascimento: "2018-10-05",
      sexo: "C",
      pelagem: "Alazã",
    });

    expect(resposta.status).toBe(201);
    expect(resposta.headers.location).toBe(`/animais/${resposta.body.id}`);
    expect(resposta.body).toEqual({
      id: expect.any(String),
      nome: "Relampago",
      registroAssociacao: "ABQM-12345",
      dataNascimento: "2018-10-05",
      sexo: "C",
      pelagem: "Alazã",
      ativo: true,
      papel: "proprietario",
    });

    const animal = await prisma.animal.findUnique({ where: { id: resposta.body.id } });
    expect(animal.proprietarioId).toBe(dono.id);
    const vinculo = await prisma.vinculoAcesso.findFirst({ where: { animalId: animal.id }, include: { papel: true } });
    expect(vinculo).toMatchObject({ usuarioId: dono.id, dataFim: null, ativo: true, concedidoPor: dono.id });
    expect(vinculo.papel.nome).toBe("proprietario");

    expect(await registrosDeAuditoria({ acao: "animal_criado", entidadeId: animal.id })).toHaveLength(1);
  });

  test("sexo aceita apenas M, F ou C", async () => {
    const dono = await criarUsuario("Dono");
    const resposta = await api(dono.token).post("/animais").send({ nome: "Teste", sexo: "X" });
    expect(resposta.status).toBe(422);
    expect(resposta.body.erro).toBe("O sexo deve ser M (macho), F (fêmea) ou C (macho castrado).");
  });

  test("data de nascimento no futuro e recusada", async () => {
    const dono = await criarUsuario("Dono");
    const resposta = await api(dono.token).post("/animais").send({ nome: "Teste", sexo: "M", dataNascimento: "2999-01-01" });
    expect(resposta.status).toBe(422);
  });
});

describe("listagem de animais com vinculo vigente (RF08)", () => {
  test("cada usuario ve apenas os animais em que tem vinculo, com o papel de cada um", async () => {
    const ana = await criarUsuario("Ana");
    const beto = await criarUsuario("Beto");
    const daAna = await criarAnimal(ana, { nome: "Da Ana" });
    const doBeto = await criarAnimal(beto, { nome: "Do Beto" });
    // mesma pessoa, papeis diferentes em animais diferentes (regra 3)
    await conceder(beto, doBeto.id, ana, "veterinario");

    const lista = await api(ana.token).get("/animais");
    expect(lista.status).toBe(200);
    expect(lista.body.itens.map((a) => [a.nome, a.papel])).toEqual([
      ["Da Ana", "proprietario"],
      ["Do Beto", "veterinario"],
    ]);

    const listaBeto = await api(beto.token).get("/animais");
    expect(listaBeto.body.itens.map((a) => a.id)).toEqual([doBeto.id]);
    expect(listaBeto.body.itens.map((a) => a.id)).not.toContain(daAna.id);
  });
});

describe("edicao e inativacao (RF05)", () => {
  test("proprietario edita e inativa; operacao vai para a auditoria", async () => {
    const dono = await criarUsuario("Dono");
    const animal = await criarAnimal(dono);

    const edicao = await api(dono.token).patch(`/animais/${animal.id}`).send({ pelagem: "Tordilha", ativo: false });
    expect(edicao.status).toBe(200);
    expect(edicao.body).toMatchObject({ pelagem: "Tordilha", ativo: false });
    expect(await registrosDeAuditoria({ acao: "animal_editado", entidadeId: animal.id })).toHaveLength(1);
  });

  test("corpo vazio responde 422", async () => {
    const dono = await criarUsuario("Dono");
    const animal = await criarAnimal(dono);
    const edicao = await api(dono.token).patch(`/animais/${animal.id}`).send({});
    expect(edicao.status).toBe(422);
  });
});

describe("concessao de acesso (RF06, UC03)", () => {
  test("registra o vinculo com papel e vigencia e grava auditoria", async () => {
    const dono = await criarUsuario("Dono");
    const vet = await criarUsuario("Vet");
    const animal = await criarAnimal(dono);

    const resposta = await api(dono.token)
      .post(`/animais/${animal.id}/acessos`)
      .send({ email: vet.email, papel: "veterinario", dataInicio: "2026-01-01", dataFim: "2026-12-31" });

    expect(resposta.status).toBe(201);
    expect(resposta.body).toMatchObject({
      animalId: animal.id,
      usuario: { id: vet.id, nome: "Vet", email: vet.email },
      papel: "veterinario",
      dataInicio: "2026-01-01",
      dataFim: "2026-12-31",
      ativo: true,
    });
    expect(await registrosDeAuditoria({ acao: "acesso_concedido", entidadeId: resposta.body.id })).toHaveLength(1);
  });

  test("fluxo alternativo 4a: convidado nao cadastrado responde 404 orientando o cadastro", async () => {
    const dono = await criarUsuario("Dono");
    const animal = await criarAnimal(dono);
    const resposta = await api(dono.token)
      .post(`/animais/${animal.id}/acessos`)
      .send({ email: "nao.existe@teste.equilog", papel: "treinador" });

    expect(resposta.status).toBe(404);
    expect(resposta.body.erro).toMatch(/se cadastrar no EquiLog/);
  });

  test("recusa vinculo ativo equivalente", async () => {
    const dono = await criarUsuario("Dono");
    const vet = await criarUsuario("Vet");
    const animal = await criarAnimal(dono);
    await conceder(dono, animal.id, vet, "veterinario");

    const repetido = await api(dono.token).post(`/animais/${animal.id}/acessos`).send({ email: vet.email, papel: "treinador" });
    expect(repetido.status).toBe(422);
  });

  test("papel de proprietario nao pode ser concedido nem revogado", async () => {
    const dono = await criarUsuario("Dono");
    const outro = await criarUsuario("Outro");
    const animal = await criarAnimal(dono);

    const concessao = await api(dono.token).post(`/animais/${animal.id}/acessos`).send({ email: outro.email, papel: "proprietario" });
    expect(concessao.status).toBe(422);

    const vinculoDono = await prisma.vinculoAcesso.findFirst({ where: { usuarioId: dono.id } });
    const revogacao = await api(dono.token).delete(`/acessos/${vinculoDono.id}`);
    expect(revogacao.status).toBe(422);
  });

  test("data de fim anterior ao inicio e recusada", async () => {
    const dono = await criarUsuario("Dono");
    const vet = await criarUsuario("Vet");
    const animal = await criarAnimal(dono);
    const resposta = await api(dono.token)
      .post(`/animais/${animal.id}/acessos`)
      .send({ email: vet.email, papel: "veterinario", dataInicio: "2026-05-01", dataFim: "2026-04-01" });
    expect(resposta.status).toBe(422);
  });

  test("vinculo inexistente responde 404", async () => {
    const dono = await criarUsuario("Dono");
    const resposta = await api(dono.token).delete("/acessos/00000000-0000-4000-8000-000000000000");
    expect(resposta.status).toBe(404);
  });
});

describe("identificadores malformados", () => {
  test("animal com identificador invalido e tratado como sem vinculo, sem erro interno", async () => {
    const dono = await criarUsuario("Dono");
    const resposta = await api(dono.token).get("/animais/nao-e-um-uuid");
    expect(resposta.status).toBe(403);
  });
});
