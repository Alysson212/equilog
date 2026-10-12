// Lembretes (RF17 a RF19, CT15), anexos (RF20) e trilha de auditoria (RF23).

const fs = require("node:fs");
const path = require("node:path");
const {
  api,
  prisma,
  limparBase,
  montarCenario,
  criarUsuario,
  criarAnimal,
  conceder,
  novoEvento,
  registrarEvento,
  registrosDeAuditoria,
  encerrar,
} = require("./apoio");

beforeEach(limparBase);
afterAll(encerrar);

async function cenarioComLembrete() {
  const cenario = await montarCenario();
  const evento = await registrarEvento(
    cenario.veterinario,
    cenario.animal.id,
    novoEvento("saude", { titulo: "Vacina influenza", detalhe: { dataRetorno: "2026-09-14" } }),
  );
  return { ...cenario, evento, lembreteId: evento.lembreteGerado.id };
}

describe("CT15 - lembrete marcado como cumprido (RF19)", () => {
  test("estado alterado no servidor e registrado na auditoria", async () => {
    const { proprietario, lembreteId } = await cenarioComLembrete();

    const resposta = await api(proprietario.token).patch(`/lembretes/${lembreteId}`).send({ status: "cumprido" });

    expect(resposta.status).toBe(200);
    expect(resposta.body).toMatchObject({ id: lembreteId, status: "cumprido", dataPrevista: "2026-09-14" });
    expect((await prisma.lembrete.findUnique({ where: { id: lembreteId } })).status).toBe("cumprido");
    expect(await registrosDeAuditoria({ acao: "lembrete_cumprido", entidadeId: lembreteId })).toHaveLength(1);

    // deixa de constar entre os pendentes, que o aplicativo usa para agendar
    // as notificacoes; o cancelamento da notificacao no dispositivo e verificado
    // no aplicativo (Etapa 5)
    const pendentes = await api(proprietario.token).get("/lembretes?status=pendente");
    expect(pendentes.body.itens.map((l) => l.id)).not.toContain(lembreteId);
  });
});

describe("listagem de lembretes (RF18)", () => {
  test("cada papel ve os lembretes dos seus animais cujo evento de origem pode ler", async () => {
    const { proprietario, veterinario, manejo, lembreteId, evento } = await cenarioComLembrete();

    const doVet = await api(veterinario.token).get("/lembretes");
    expect(doVet.status).toBe(200);
    expect(doVet.body.itens).toEqual([
      {
        id: lembreteId,
        animal: { id: evento.animalId, nome: "Estrela" },
        dataPrevista: "2026-09-14",
        status: "pendente",
        papel: "veterinario",
        evento: { id: evento.id, titulo: "Vacina influenza", tipoEvento: "vacinacao" },
      },
    ]);

    const doDono = await api(proprietario.token).get("/lembretes");
    expect(doDono.body.itens.map((l) => l.id)).toEqual([lembreteId]);
  });

  test("lembrete herda a visibilidade do evento: manejo nao ve lembrete de saude, nem em contagem", async () => {
    const { manejo, lembreteId } = await cenarioComLembrete();

    for (const filtro of ["", "?status=pendente"]) {
      const resposta = await api(manejo.token).get(`/lembretes${filtro}`);
      expect(resposta.status).toBe(200);
      expect(resposta.body).toEqual({ itens: [] });
    }

    // nem pela alteracao direta: a recusa vem da leitura do dominio de origem
    const alteracao = await api(manejo.token).patch(`/lembretes/${lembreteId}`).send({ status: "cumprido" });
    expect(alteracao.status).toBe(403);
    expect(await registrosDeAuditoria({ usuarioId: manejo.id, motivo: "papel_insuficiente", entidade: "saude" })).toHaveLength(1);
    expect((await prisma.lembrete.findUnique({ where: { id: lembreteId } })).status).toBe("pendente");
  });

  test("lembrete de outro animal em que o manejo tem vinculo continua oculto se for de saude", async () => {
    const { proprietario, veterinario, manejo, animal } = await cenarioComLembrete();
    const segundo = await criarAnimal(proprietario, { nome: "Segundo" });
    await conceder(proprietario, segundo.id, veterinario, "veterinario");
    await conceder(proprietario, segundo.id, manejo, "manejo");
    await registrarEvento(veterinario, segundo.id, novoEvento("saude", { detalhe: { dataRetorno: "2026-11-01" } }));

    const doManejo = await api(manejo.token).get("/lembretes");
    expect(doManejo.body.itens).toEqual([]);
    const doVet = await api(veterinario.token).get("/lembretes");
    expect(doVet.body.itens.map((l) => l.animal.id).sort()).toEqual([animal.id, segundo.id].sort());
  });

  test("usuario sem vinculo nao ve lembretes de outros animais", async () => {
    await cenarioComLembrete();
    const estranho = await criarUsuario("Estranho");
    const resposta = await api(estranho.token).get("/lembretes");
    expect(resposta.body.itens).toEqual([]);
  });

  test("filtro de estado invalido responde 422", async () => {
    const { proprietario } = await cenarioComLembrete();
    const resposta = await api(proprietario.token).get("/lembretes?status=atrasado");
    expect(resposta.status).toBe(422);
  });
});

describe("alteracao de estado do lembrete (RF19)", () => {
  test("adiar com nova data informada pela pessoa", async () => {
    const { treinador, lembreteId } = await cenarioComLembrete();
    const resposta = await api(treinador.token)
      .patch(`/lembretes/${lembreteId}`)
      .send({ status: "adiado", dataPrevista: "2026-09-30" });

    expect(resposta.status).toBe(200);
    expect(resposta.body).toMatchObject({ status: "adiado", dataPrevista: "2026-09-30" });
  });

  test("nova data so e aceita ao adiar; estado pendente nao pode ser atribuido", async () => {
    const { veterinario, lembreteId } = await cenarioComLembrete();
    const comData = await api(veterinario.token)
      .patch(`/lembretes/${lembreteId}`)
      .send({ status: "cumprido", dataPrevista: "2026-09-30" });
    expect(comData.status).toBe(422);

    const pendente = await api(veterinario.token).patch(`/lembretes/${lembreteId}`).send({ status: "pendente" });
    expect(pendente.status).toBe(422);
    expect(pendente.body.erro).toBe("Marque o lembrete como cumprido, adiado ou cancelado.");
  });

  test("lembrete cumprido nao e alterado por edicao nem por exclusao posterior do evento", async () => {
    const { proprietario, veterinario, evento, lembreteId } = await cenarioComLembrete();
    await api(proprietario.token).patch(`/lembretes/${lembreteId}`).send({ status: "cumprido" });

    await api(veterinario.token).patch(`/eventos/${evento.id}`).send({ detalhe: { dataRetorno: null } });
    let lembrete = await prisma.lembrete.findUnique({ where: { id: lembreteId } });
    expect(lembrete.status).toBe("cumprido");
    expect(lembrete.dataPrevista.toISOString().slice(0, 10)).toBe("2026-09-14");

    await api(proprietario.token).delete(`/eventos/${evento.id}`);
    lembrete = await prisma.lembrete.findUnique({ where: { id: lembreteId } });
    expect(lembrete.status).toBe("cumprido");
    expect(await registrosDeAuditoria({ entidadeId: lembreteId, acao: "lembrete_cancelado" })).toHaveLength(0);
  });

  test("lembrete adiado esta em aberto: edicao da data de retorno o reajusta", async () => {
    const { treinador, veterinario, evento, lembreteId } = await cenarioComLembrete();
    await api(treinador.token).patch(`/lembretes/${lembreteId}`).send({ status: "adiado", dataPrevista: "2026-09-20" });

    await api(veterinario.token).patch(`/eventos/${evento.id}`).send({ detalhe: { dataRetorno: "2026-10-05" } });
    const lembrete = await prisma.lembrete.findUnique({ where: { id: lembreteId } });
    expect(lembrete.dataPrevista.toISOString().slice(0, 10)).toBe("2026-10-05");
    expect(lembrete.status).toBe("pendente");
  });

  test("lembrete inexistente responde 404", async () => {
    const { proprietario } = await cenarioComLembrete();
    const resposta = await api(proprietario.token)
      .patch("/lembretes/00000000-0000-4000-8000-000000000000")
      .send({ status: "cumprido" });
    expect(resposta.status).toBe(404);
  });
});

describe("anexo de arquivo a evento (RF20)", () => {
  const PDF = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n");
  const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);

  test("veterinario anexa PDF ao proprio evento de saude; arquivo e registro gravados", async () => {
    const { veterinario, evento } = await cenarioComLembrete();

    const resposta = await api(veterinario.token)
      .post(`/eventos/${evento.id}/anexos`)
      .attach("arquivo", PDF, { filename: "../../exame.pdf", contentType: "application/pdf" });

    expect(resposta.status).toBe(201);
    expect(resposta.body).toEqual({
      id: expect.any(String),
      eventoId: evento.id,
      nomeArquivo: "exame.pdf",
      mimeType: "application/pdf",
      tamanhoBytes: PDF.length,
    });

    const anexo = await prisma.anexo.findUnique({ where: { id: resposta.body.id } });
    expect(anexo.caminho).toBe(`${evento.id}/${anexo.id}.pdf`);
    const gravado = fs.readFileSync(path.join(process.env.DIRETORIO_ANEXOS, anexo.caminho));
    expect(gravado.equals(PDF)).toBe(true);
    expect(await registrosDeAuditoria({ acao: "anexo_enviado", entidadeId: anexo.id })).toHaveLength(1);
  });

  test("treinador anexa imagem a evento de treinamento", async () => {
    const { treinador, animal } = await montarCenario();
    const evento = await registrarEvento(treinador, animal.id, novoEvento("treinamento"));
    const resposta = await api(treinador.token)
      .post(`/eventos/${evento.id}/anexos`)
      .attach("arquivo", PNG, { filename: "pista.png", contentType: "image/png" });
    expect(resposta.status).toBe(201);
    expect(resposta.body.mimeType).toBe("image/png");
  });

  test("responsavel pelo manejo apenas le anexos: envio responde 403 sem gravar arquivo", async () => {
    const { manejo, animal } = await montarCenario();
    const evento = await registrarEvento(manejo, animal.id, novoEvento("manejo"));

    const resposta = await api(manejo.token)
      .post(`/eventos/${evento.id}/anexos`)
      .attach("arquivo", PDF, { filename: "nota.pdf", contentType: "application/pdf" });

    expect(resposta.status).toBe(403);
    expect(await prisma.anexo.count()).toBe(0);
    expect(fs.existsSync(path.join(process.env.DIRETORIO_ANEXOS, evento.id))).toBe(false);
  });

  test("veterinario nao anexa a evento de competicao, dominio que nao le", async () => {
    const { veterinario, treinador, animal } = await montarCenario();
    const evento = await registrarEvento(treinador, animal.id, novoEvento("competicao"));
    const resposta = await api(veterinario.token)
      .post(`/eventos/${evento.id}/anexos`)
      .attach("arquivo", PDF, { filename: "resultado.pdf" });
    expect(resposta.status).toBe(403);
  });

  test("tipo identificado pelo conteudo: texto disfarcado de PDF e recusado", async () => {
    const { veterinario, evento } = await cenarioComLembrete();
    const resposta = await api(veterinario.token)
      .post(`/eventos/${evento.id}/anexos`)
      .attach("arquivo", Buffer.from("isto nao e um pdf"), { filename: "falso.pdf", contentType: "application/pdf" });

    expect(resposta.status).toBe(422);
    expect(resposta.body.erro).toBe("Envie uma imagem (JPG, PNG ou WEBP) ou um documento em PDF.");
    expect(await prisma.anexo.count()).toBe(0);
  });

  test("sem arquivo ou acima de 10 MB responde 422", async () => {
    const { veterinario, evento } = await cenarioComLembrete();

    const semArquivo = await api(veterinario.token).post(`/eventos/${evento.id}/anexos`);
    expect(semArquivo.status).toBe(422);
    expect(semArquivo.body.erro).toBe("Selecione um arquivo para anexar.");

    const grande = Buffer.concat([PDF, Buffer.alloc(10 * 1024 * 1024)]);
    const excesso = await api(veterinario.token)
      .post(`/eventos/${evento.id}/anexos`)
      .attach("arquivo", grande, { filename: "grande.pdf" });
    expect(excesso.status).toBe(422);
    expect(excesso.body.erro).toBe("O arquivo deve ter no máximo 10 MB.");
  });
});

describe("trilha de auditoria do animal (RF23)", () => {
  test("proprietario consulta escritas e negacoes do seu animal, sem dados pessoais de terceiros", async () => {
    const { proprietario, veterinario, animal, evento, lembreteId } = await cenarioComLembrete();
    await api(veterinario.token).post(`/animais/${animal.id}/eventos`).send(novoEvento("competicao")); // negada
    const outro = await criarAnimal(proprietario, { nome: "Outro" });

    const resposta = await api(proprietario.token).get(`/animais/${animal.id}/auditoria`);

    expect(resposta.status).toBe(200);
    const acoes = resposta.body.itens.map((r) => [r.acao, r.entidadeId]);
    expect(acoes).toEqual(
      expect.arrayContaining([
        ["animal_criado", animal.id],
        ["acesso_concedido", expect.any(String)],
        ["evento_criado", evento.id],
        ["lembrete_criado", lembreteId],
        ["acesso_negado", animal.id],
      ]),
    );
    expect(acoes.map(([, id]) => id)).not.toContain(outro.id);

    const negacao = resposta.body.itens.find((r) => r.acao === "acesso_negado");
    expect(negacao).toMatchObject({ motivo: "papel_insuficiente", entidade: "competicao", usuario: { nome: "Veterinario" } });
    expect(JSON.stringify(resposta.body)).not.toMatch(/enderecoIp|endereco_ip|identificadorTentativa|::ffff|127\.0\.0\.1/);

    // ordem do mais recente para o mais antigo, com paginacao
    const datas = resposta.body.itens.map((r) => r.dataHora);
    expect([...datas].sort().reverse()).toEqual(datas);
    const pagina = await api(proprietario.token).get(`/animais/${animal.id}/auditoria?limite=2`);
    expect(pagina.body.itens).toHaveLength(2);
    expect(pagina.body.total).toBe(resposta.body.total);
  });

  test.each(["veterinario", "treinador", "manejo"])("%s nao consulta a trilha (403)", async (papel) => {
    const cenario = await montarCenario();
    const resposta = await api(cenario[papel].token).get(`/animais/${cenario.animal.id}/auditoria`);
    expect(resposta.status).toBe(403);
  });
});
