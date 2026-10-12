// POST /sincronizacao/lote (decisao 9.3), GET /animais/{id}/exportacao (RF22),
// GET /animais/{id}/acessos e GET /anexos/{id}.

const { randomUUID } = require("node:crypto");
const {
  api,
  prisma,
  limparBase,
  montarCenario,
  criarUsuario,
  novoEvento,
  registrarEvento,
  registrosDeAuditoria,
  encerrar,
} = require("./apoio");
const { montarHistorico } = require("../../src/servicos/exportacaoServico");

beforeEach(limparBase);
afterAll(encerrar);

function itemDeLote(animalId, dominio, extra = {}) {
  return { ...novoEvento(dominio, extra), animalId, versao: 1 };
}

describe("POST /sincronizacao/lote (decisao 9.3)", () => {
  test("id inexistente cria o evento e volta sincronizado", async () => {
    const { manejo, animal } = await montarCenario();
    const item = itemDeLote(animal.id, "manejo");

    const resposta = await api(manejo.token).post("/sincronizacao/lote").send([item]);

    expect(resposta.status).toBe(200);
    expect(resposta.body).toEqual({ resultados: [{ id: item.id, situacao: "sincronizado", versaoServidor: 1 }] });
    const gravado = await prisma.evento.findUnique({ where: { id: item.id }, include: { manejo: true } });
    expect(gravado.registradoPor).toBe(manejo.id);
    expect(gravado.manejo.categoria).toBe("casco");
  });

  test("id existente na mesma versao nao duplica e volta sincronizado (idempotencia, CT11)", async () => {
    const { manejo, animal } = await montarCenario();
    const item = itemDeLote(animal.id, "manejo");

    await api(manejo.token).post("/sincronizacao/lote").send([item]);
    const reenvio = await api(manejo.token).post("/sincronizacao/lote").send([item, item]);

    expect(reenvio.body.resultados).toEqual([
      { id: item.id, situacao: "sincronizado", versaoServidor: 1 },
      { id: item.id, situacao: "sincronizado", versaoServidor: 1 },
    ]);
    expect(await prisma.evento.count({ where: { id: item.id } })).toBe(1);
    expect(await registrosDeAuditoria({ acao: "evento_criado", entidadeId: item.id })).toHaveLength(1);
  });

  test("versao do servidor maior responde conflito sem alterar nada", async () => {
    const { treinador, animal } = await montarCenario();
    const item = itemDeLote(animal.id, "treinamento", { titulo: "Original" });
    await api(treinador.token).post("/sincronizacao/lote").send([item]);
    await api(treinador.token).patch(`/eventos/${item.id}`).send({ titulo: "Editado no servidor" });

    const resposta = await api(treinador.token).post("/sincronizacao/lote").send([{ ...item, titulo: "Versao local" }]);

    expect(resposta.body.resultados).toEqual([{ id: item.id, situacao: "conflito", versaoServidor: 2 }]);
    const gravado = await prisma.evento.findUnique({ where: { id: item.id } });
    expect(gravado).toMatchObject({ titulo: "Editado no servidor", versao: 2 });
  });

  test("vinculo revogado e papel insuficiente voltam recusado e vao para a auditoria", async () => {
    const { proprietario, treinador, veterinario, animal } = await montarCenario();
    const vinculo = await prisma.vinculoAcesso.findFirst({ where: { usuarioId: treinador.id } });
    await api(proprietario.token).delete(`/acessos/${vinculo.id}`);

    const revogado = itemDeLote(animal.id, "treinamento");
    const semPapel = itemDeLote(animal.id, "competicao");
    const r1 = await api(treinador.token).post("/sincronizacao/lote").send([revogado]);
    const r2 = await api(veterinario.token).post("/sincronizacao/lote").send([semPapel]);

    expect(r1.body.resultados).toEqual([{ id: revogado.id, situacao: "recusado", versaoServidor: null, motivo: "sem_vinculo" }]);
    expect(r2.body.resultados).toEqual([{ id: semPapel.id, situacao: "recusado", versaoServidor: null, motivo: "papel_insuficiente" }]);
    expect(await prisma.evento.count()).toBe(0);
    expect(await registrosDeAuditoria({ entidade: "sincronizacao", acao: "acesso_negado" })).toHaveLength(2);
  });

  test("um resultado por item, na ordem enviada, com situacoes diferentes no mesmo lote", async () => {
    const { veterinario, animal } = await montarCenario();
    const valido = itemDeLote(animal.id, "saude", { detalhe: { dataRetorno: "2026-09-14" } });
    const proibido = itemDeLote(animal.id, "competicao");
    const invalido = { ...itemDeLote(animal.id, "saude"), titulo: "" };

    const resposta = await api(veterinario.token).post("/sincronizacao/lote").send([valido, proibido, invalido]);

    expect(resposta.status).toBe(200);
    expect(resposta.body.resultados.map((r) => [r.id, r.situacao])).toEqual([
      [valido.id, "sincronizado"],
      [proibido.id, "recusado"],
      [invalido.id, "recusado"],
    ]);
    expect(resposta.body.resultados[2]).toMatchObject({
      motivo: "dados_invalidos",
      campos: [{ campo: "titulo", mensagem: "Informe o título." }],
    });
    // o lembrete nasce tambem pela sincronizacao (RF17)
    expect(await prisma.lembrete.count({ where: { eventoId: valido.id } })).toBe(1);
  });

  test("id de evento de outro autor e recusado", async () => {
    const { manejo, proprietario, animal } = await montarCenario();
    const item = itemDeLote(animal.id, "manejo");
    await api(manejo.token).post("/sincronizacao/lote").send([item]);
    const resposta = await api(proprietario.token).post("/sincronizacao/lote").send([item]);
    expect(resposta.body.resultados[0]).toMatchObject({ situacao: "recusado", motivo: "id_de_outro_registro" });
  });

  test("envelope invalido: corpo que nao e lista, lote grande demais, sem credencial", async () => {
    const { manejo, animal } = await montarCenario();
    expect((await api(manejo.token).post("/sincronizacao/lote").send({ eventos: [] })).status).toBe(400);
    const grande = Array.from({ length: 101 }, () => itemDeLote(animal.id, "manejo"));
    expect((await api(manejo.token).post("/sincronizacao/lote").send(grande)).status).toBe(422);
    expect((await api().post("/sincronizacao/lote").send([])).status).toBe(401);
    const vazio = await api(manejo.token).post("/sincronizacao/lote").send([]);
    expect(vazio.body).toEqual({ resultados: [] });
  });

  test("item sem animal ou versao volta recusado por dados invalidos", async () => {
    const { manejo } = await montarCenario();
    const resposta = await api(manejo.token).post("/sincronizacao/lote").send([{ id: randomUUID(), dominio: "manejo" }, "texto"]);
    expect(resposta.body.resultados[0]).toMatchObject({ situacao: "recusado", motivo: "dados_invalidos" });
    expect(resposta.body.resultados[0].campos.map((c) => c.campo)).toEqual(["animalId", "versao"]);
    expect(resposta.body.resultados[1]).toEqual({ id: null, situacao: "recusado", versaoServidor: null, motivo: "dados_invalidos" });
  });
});

describe("GET /animais/{id}/exportacao (RF22)", () => {
  test("proprietario recebe o historico em PDF e a exportacao vai para a auditoria", async () => {
    const { proprietario, treinador, animal } = await montarCenario();
    await registrarEvento(treinador, animal.id, novoEvento("treinamento"));

    const resposta = await api(proprietario.token).get(`/animais/${animal.id}/exportacao`).buffer(true);

    expect(resposta.status).toBe(200);
    expect(resposta.headers["content-type"]).toBe("application/pdf");
    expect(resposta.headers["content-disposition"]).toBe('attachment; filename="historico-estrela.pdf"');
    expect(resposta.body.subarray(0, 5).toString()).toBe("%PDF-");
    expect(await registrosDeAuditoria({ acao: "historico_exportado", entidadeId: animal.id })).toHaveLength(1);
  });

  test("conteudo segue a linha do tempo do papel: dominios legiveis e sem eventos excluidos", async () => {
    const cenario = await montarCenario();
    const { animal } = cenario;
    await registrarEvento(cenario.veterinario, animal.id, novoEvento("saude"));
    await registrarEvento(cenario.treinador, animal.id, novoEvento("competicao"));
    const excluido = await registrarEvento(cenario.treinador, animal.id, novoEvento("treinamento"));
    await api(cenario.proprietario.token).delete(`/eventos/${excluido.id}`);

    const doVet = await montarHistorico({ papel: "veterinario" }, animal.id);
    expect(doVet.eventos.map((e) => e.dominio)).toEqual(["saude"]);

    const doDono = await montarHistorico({ papel: "proprietario" }, animal.id);
    expect(doDono.eventos.map((e) => e.dominio).sort()).toEqual(["competicao", "saude"]);
    expect(doDono.eventos.map((e) => e.id)).not.toContain(excluido.id);
  });

  test("responsavel pelo manejo nao exporta (403)", async () => {
    const { manejo, animal } = await montarCenario();
    const resposta = await api(manejo.token).get(`/animais/${animal.id}/exportacao`);
    expect(resposta.status).toBe(403);
  });
});

describe("GET /animais/{id}/acessos", () => {
  test("proprietario ve os vinculos do animal, inclusive revogados", async () => {
    const { proprietario, treinador, animal } = await montarCenario();
    const vinculo = await prisma.vinculoAcesso.findFirst({ where: { usuarioId: treinador.id } });
    await api(proprietario.token).delete(`/acessos/${vinculo.id}`);

    const resposta = await api(proprietario.token).get(`/animais/${animal.id}/acessos`);

    expect(resposta.status).toBe(200);
    expect(resposta.body.itens).toHaveLength(4);
    const doTreinador = resposta.body.itens.find((v) => v.id === vinculo.id);
    expect(doTreinador).toMatchObject({ papel: "treinador", ativo: false, vigente: false, usuario: { nome: "Treinador" } });
    const doDono = resposta.body.itens.find((v) => v.papel === "proprietario");
    expect(doDono).toMatchObject({ ativo: true, vigente: true, dataFim: null });
  });

  test.each(["veterinario", "treinador", "manejo"])("%s nao lista acessos (403)", async (papel) => {
    const cenario = await montarCenario();
    const resposta = await api(cenario[papel].token).get(`/animais/${cenario.animal.id}/acessos`);
    expect(resposta.status).toBe(403);
  });
});

describe("GET /anexos/{id}", () => {
  const PDF = Buffer.from("%PDF-1.4\nconteudo de teste\n%%EOF\n");

  async function cenarioComAnexo() {
    const cenario = await montarCenario();
    const evento = await registrarEvento(cenario.veterinario, cenario.animal.id, novoEvento("saude"));
    const envio = await api(cenario.veterinario.token)
      .post(`/eventos/${evento.id}/anexos`)
      .attach("arquivo", PDF, { filename: "exame de sangue.pdf" });
    return { ...cenario, evento, anexoId: envio.body.id };
  }

  test("quem le o dominio do evento baixa o arquivo integro", async () => {
    const { proprietario, anexoId } = await cenarioComAnexo();
    const resposta = await api(proprietario.token).get(`/anexos/${anexoId}`).buffer(true);

    expect(resposta.status).toBe(200);
    expect(resposta.headers["content-type"]).toBe("application/pdf");
    expect(resposta.headers["content-disposition"]).toBe('attachment; filename="exame de sangue.pdf"');
    expect(Buffer.from(resposta.body).equals(PDF)).toBe(true);
  });

  test("manejo tem L em anexos, mas nao le saude: 403", async () => {
    const { manejo, anexoId } = await cenarioComAnexo();
    const resposta = await api(manejo.token).get(`/anexos/${anexoId}`);
    expect(resposta.status).toBe(403);
    expect(await registrosDeAuditoria({ usuarioId: manejo.id, motivo: "papel_insuficiente", entidade: "saude" })).toHaveLength(1);
  });

  test("usuario sem vinculo recebe 403; anexo inexistente ou de evento excluido, 404", async () => {
    const { proprietario, evento, anexoId } = await cenarioComAnexo();
    const estranho = await criarUsuario("Estranho");
    expect((await api(estranho.token).get(`/anexos/${anexoId}`)).status).toBe(403);
    expect((await api(proprietario.token).get(`/anexos/${randomUUID()}`)).status).toBe(404);

    await api(proprietario.token).delete(`/eventos/${evento.id}`);
    expect((await api(proprietario.token).get(`/anexos/${anexoId}`)).status).toBe(404);
  });
});
