// Eventos e linha do tempo: CT03, CT04, CT06, CT13 e CT14
// (RF09 a RF17, UC08, decisao 9.4).

const { randomUUID } = require("node:crypto");
const {
  api,
  prisma,
  limparBase,
  montarCenario,
  novoEvento,
  registrarEvento,
  registrosDeAuditoria,
  encerrar,
} = require("./apoio");

beforeEach(limparBase);
afterAll(encerrar);

describe("registro de evento (RF09 a RF12)", () => {
  test("exemplo normativo: evento de saude com data de retorno", async () => {
    const { veterinario, animal } = await montarCenario();
    const id = "3f2a7c90-5e41-4b2d-9a77-0c13ef8b4411";

    const resposta = await api(veterinario.token)
      .post(`/animais/${animal.id}/eventos`)
      .send({
        id,
        dominio: "saude",
        tipoEvento: "vacinacao",
        dataEvento: "2026-03-14T09:30:00-03:00",
        titulo: "Vacinacao contra influenza equina",
        observacao: "Animal sem reacao adversa ate o fim do atendimento.",
        detalhe: {
          procedimento: "vacinacao",
          produto: "Vacina influenza equina",
          dose: "1 mL",
          via: "intramuscular",
          dataRetorno: "2026-09-14",
        },
      });

    expect(resposta.status).toBe(201);
    expect(resposta.headers.location).toBe(`/eventos/${id}`);
    expect(resposta.body).toMatchObject({
      id,
      animalId: animal.id,
      dominio: "saude",
      dataEvento: "2026-03-14T09:30:00-03:00",
      registradoPor: { id: veterinario.id, nome: "Veterinario" },
      versao: 1,
      lembreteGerado: { id: expect.any(String), dataPrevista: "2026-09-14", status: "pendente" },
    });
    expect(resposta.body.detalhe).toEqual({
      procedimento: "vacinacao",
      produto: "Vacina influenza equina",
      dose: "1 mL",
      via: "intramuscular",
      profissional: null,
      dataRetorno: "2026-09-14",
    });
  });

  test.each([
    ["manejo", "manejo", { categoria: "alimentacao", descricao: "Racao", quantidade: 4.5, unidade: "kg" }],
    ["treinamento", "treinador", { tipoExercicio: "tambor", duracaoMin: 40, intensidade: "moderada", piso: "areia" }],
    ["competicao", "treinador", { nomeProva: "Copa", local: "Paraisopolis", categoria: "Aberta", tempoSegundos: 16.284, colocacao: 2, penalidade: 5 }],
  ])("registra evento de %s com atributos especificos no subtipo", async (dominio, papel, detalhe) => {
    const cenario = await montarCenario();
    const evento = await registrarEvento(cenario[papel], cenario.animal.id, novoEvento(dominio, { detalhe }));

    expect(evento.dominio).toBe(dominio);
    expect(evento.detalhe).toMatchObject(detalhe);
    expect(evento.lembreteGerado).toBeNull();
  });

  test("identificador vem do cliente e o reenvio pelo mesmo autor nao duplica", async () => {
    const { manejo, animal } = await montarCenario();
    const corpo = novoEvento("manejo");

    const primeiro = await api(manejo.token).post(`/animais/${animal.id}/eventos`).send(corpo);
    const reenvio = await api(manejo.token).post(`/animais/${animal.id}/eventos`).send(corpo);

    expect(primeiro.status).toBe(201);
    expect(primeiro.body.id).toBe(corpo.id);
    expect(reenvio.status).toBe(200);
    expect(reenvio.body.id).toBe(corpo.id);
    expect(await prisma.evento.count({ where: { id: corpo.id } })).toBe(1);
  });

  test("identificador ja usado por outro autor e recusado", async () => {
    const { manejo, proprietario, animal } = await montarCenario();
    const corpo = novoEvento("manejo");
    await registrarEvento(manejo, animal.id, corpo);

    const resposta = await api(proprietario.token).post(`/animais/${animal.id}/eventos`).send(corpo);
    expect(resposta.status).toBe(422);
    expect(resposta.body.erro).toBe("Este identificador de registro já está em uso.");
  });

  test("tipo de evento de outro dominio e recusado", async () => {
    const { manejo, animal } = await montarCenario();
    const resposta = await api(manejo.token)
      .post(`/animais/${animal.id}/eventos`)
      .send(novoEvento("manejo", { tipoEvento: "vacinacao" }));
    expect(resposta.status).toBe(422);
    expect(resposta.body.erro).toBe("Escolha um tipo de registro da lista.");
  });

  test("escrita registrada na auditoria", async () => {
    const { treinador, animal } = await montarCenario();
    const evento = await registrarEvento(treinador, animal.id, novoEvento("treinamento"));
    expect(await registrosDeAuditoria({ acao: "evento_criado", entidadeId: evento.id, usuarioId: treinador.id })).toHaveLength(1);
  });
});

describe("CT03 - evento de saude com data de retorno (RF09, RF17)", () => {
  test("evento, subtipo e lembrete criados na mesma transacao", async () => {
    const { veterinario, animal } = await montarCenario();
    const evento = await registrarEvento(
      veterinario,
      animal.id,
      novoEvento("saude", { detalhe: { dataRetorno: "2026-09-14" } }),
    );

    const gravado = await prisma.evento.findUnique({ where: { id: evento.id }, include: { saude: true, lembretes: true } });
    expect(gravado.saude.procedimento).toBe("vacinacao");
    expect(gravado.lembretes).toHaveLength(1);
    expect(gravado.lembretes[0]).toMatchObject({
      id: evento.lembreteGerado.id,
      animalId: animal.id,
      status: "pendente",
      criadoPor: veterinario.id,
    });
    expect(gravado.lembretes[0].dataPrevista.toISOString().slice(0, 10)).toBe("2026-09-14");
  });

  test("falha na transacao nao deixa evento sem lembrete nem lembrete sem evento", async () => {
    const { veterinario, animal } = await montarCenario();
    // forca a falha da ultima gravacao (o lembrete) com uma restricao temporaria
    // que recusa qualquer nova linha; evento e subtipo ja teriam sido inseridos
    const corpo = novoEvento("saude", { detalhe: { dataRetorno: "2026-09-14" } });
    await prisma.$executeRawUnsafe(`ALTER TABLE lembrete ADD CONSTRAINT teste_bloqueio CHECK (false) NOT VALID`);
    try {
      const resposta = await api(veterinario.token).post(`/animais/${animal.id}/eventos`).send(corpo);
      expect(resposta.status).toBe(500);
    } finally {
      await prisma.$executeRawUnsafe(`ALTER TABLE lembrete DROP CONSTRAINT teste_bloqueio`);
    }
    expect(await prisma.evento.count({ where: { id: corpo.id } })).toBe(0);
    expect(await prisma.eventoSaude.count({ where: { eventoId: corpo.id } })).toBe(0);
    expect(await registrosDeAuditoria({ entidadeId: corpo.id })).toHaveLength(0);
  });

  test("sem data de retorno nenhum lembrete e gerado", async () => {
    const { veterinario, animal } = await montarCenario();
    const evento = await registrarEvento(veterinario, animal.id, novoEvento("saude", { tipoEvento: "exame" }));
    expect(evento.lembreteGerado).toBeNull();
    expect(await prisma.lembrete.count()).toBe(0);
  });
});

describe("CT04 - evento sem campo obrigatorio (RNF08)", () => {
  test("responde 422 com mensagem compreensivel para cada campo", async () => {
    const { veterinario, animal } = await montarCenario();
    const resposta = await api(veterinario.token)
      .post(`/animais/${animal.id}/eventos`)
      .send({ id: randomUUID(), dominio: "saude", tipoEvento: "vacinacao", detalhe: {} });

    expect(resposta.status).toBe(422);
    expect(resposta.body.campos).toEqual([
      { campo: "dataEvento", mensagem: "Informe a data do registro." },
      { campo: "titulo", mensagem: "Informe o título." },
      { campo: "detalhe.procedimento", mensagem: "Informe o procedimento." },
    ]);
    expect(resposta.body.erro).toBe("Informe a data do registro.");
  });

  test("mensagens sem jargao tecnico para valores invalidos", async () => {
    const { treinador, animal } = await montarCenario();
    const resposta = await api(treinador.token)
      .post(`/animais/${animal.id}/eventos`)
      .send(novoEvento("competicao", { id: "123", dataEvento: "ontem", detalhe: { tempoSegundos: 15.1234, colocacao: 0 } }));

    expect(resposta.status).toBe(422);
    expect(resposta.body.campos).toEqual([
      { campo: "id", mensagem: "O identificador do registro não está em um formato válido." },
      { campo: "dataEvento", mensagem: "A data do registro deve ser uma data e hora válidas." },
      { campo: "detalhe.tempoSegundos", mensagem: "O tempo aceita no máximo 3 casas decimais." },
      { campo: "detalhe.colocacao", mensagem: "A colocação deve ser maior ou igual a 1." },
    ]);
    const textos = JSON.stringify(resposta.body);
    expect(textos).not.toMatch(/prisma|sql|null|undefined|stack|exception/i);
  });

  test("dominio ausente responde 422 antes da autorizacao", async () => {
    const { manejo, animal } = await montarCenario();
    const resposta = await api(manejo.token).post(`/animais/${animal.id}/eventos`).send({ titulo: "x" });
    expect(resposta.status).toBe(422);
    expect(resposta.body.erro).toBe("Escolha o tipo de registro: saúde, manejo, treinamento ou competição.");
  });
});

describe("CT06 - responsavel pelo manejo consulta a linha do tempo (RF13, RNF03)", () => {
  test("eventos de saude nao sao retornados nem contados", async () => {
    const { veterinario, manejo, treinador, animal } = await montarCenario();
    await registrarEvento(veterinario, animal.id, novoEvento("saude", { dataEvento: "2026-03-01T10:00:00-03:00" }));
    await registrarEvento(veterinario, animal.id, novoEvento("saude", { dataEvento: "2026-03-02T10:00:00-03:00" }));
    await registrarEvento(manejo, animal.id, novoEvento("manejo", { dataEvento: "2026-03-03T10:00:00-03:00" }));
    await registrarEvento(treinador, animal.id, novoEvento("treinamento", { dataEvento: "2026-03-04T10:00:00-03:00" }));
    await registrarEvento(treinador, animal.id, novoEvento("competicao", { dataEvento: "2026-03-05T10:00:00-03:00" }));

    const resposta = await api(manejo.token).get(`/animais/${animal.id}/eventos`);

    expect(resposta.status).toBe(200);
    expect(resposta.body.total).toBe(2);
    expect(resposta.body.itens.map((e) => e.dominio)).toEqual(["treinamento", "manejo"]);
    expect(JSON.stringify(resposta.body)).not.toMatch(/saude|vacinacao/);
  });

  test("decisao 9.4: filtro por dominio nao legivel devolve lista vazia e total zero", async () => {
    const { veterinario, manejo, animal } = await montarCenario();
    await registrarEvento(veterinario, animal.id, novoEvento("saude"));
    await registrarEvento(manejo, animal.id, novoEvento("manejo"));

    const resposta = await api(manejo.token).get(`/animais/${animal.id}/eventos?dominio=saude`);
    expect(resposta.status).toBe(200);
    expect(resposta.body).toEqual({ itens: [], total: 0, limite: 50, deslocamento: 0 });
  });

  test("veterinario nao ve competicao; proprietario ve os quatro dominios", async () => {
    const cenario = await montarCenario();
    const { animal } = cenario;
    await registrarEvento(cenario.veterinario, animal.id, novoEvento("saude"));
    await registrarEvento(cenario.manejo, animal.id, novoEvento("manejo"));
    await registrarEvento(cenario.treinador, animal.id, novoEvento("treinamento"));
    await registrarEvento(cenario.treinador, animal.id, novoEvento("competicao"));

    const vet = await api(cenario.veterinario.token).get(`/animais/${animal.id}/eventos`);
    expect(vet.body.total).toBe(3);
    expect(vet.body.itens.map((e) => e.dominio)).not.toContain("competicao");

    const dono = await api(cenario.proprietario.token).get(`/animais/${animal.id}/eventos`);
    expect(dono.body.total).toBe(4);
  });

  test("consulta registrada na auditoria (UC08, pos-condicao)", async () => {
    const { manejo, animal } = await montarCenario();
    await api(manejo.token).get(`/animais/${animal.id}/eventos`);
    expect(
      await registrosDeAuditoria({ acao: "linha_do_tempo_consultada", usuarioId: manejo.id, entidadeId: animal.id }),
    ).toHaveLength(1);
  });
});

describe("linha do tempo: ordem, filtros e paginacao (RF13, RF14)", () => {
  async function cenarioComCincoEventos() {
    const cenario = await montarCenario();
    const { animal, treinador, manejo } = cenario;
    for (let dia = 1; dia <= 3; dia += 1) {
      await registrarEvento(treinador, animal.id, novoEvento("treinamento", { dataEvento: `2026-04-0${dia}T08:00:00-03:00`, titulo: `Treino ${dia}` }));
    }
    await registrarEvento(manejo, animal.id, novoEvento("manejo", { dataEvento: "2026-04-02T07:00:00-03:00", titulo: "Trato" }));
    await registrarEvento(manejo, animal.id, novoEvento("manejo", { dataEvento: "2026-04-05T23:30:00-03:00", titulo: "Banho noturno" }));
    return cenario;
  }

  test("ordem cronologica decrescente com dominio, data e autor", async () => {
    const { proprietario, animal } = await cenarioComCincoEventos();
    const resposta = await api(proprietario.token).get(`/animais/${animal.id}/eventos`);

    expect(resposta.body.itens.map((e) => e.titulo)).toEqual(["Banho noturno", "Treino 3", "Treino 2", "Trato", "Treino 1"]);
    expect(resposta.body.itens[0]).toMatchObject({
      dominio: "manejo",
      dataEvento: "2026-04-05T23:30:00-03:00",
      registradoPor: { nome: "Manejo" },
    });
  });

  test("filtro por dominio, periodo (dia inteiro no fuso local) e autor", async () => {
    const { proprietario, treinador, animal } = await cenarioComCincoEventos();
    const base = `/animais/${animal.id}/eventos`;

    const porDominio = await api(proprietario.token).get(`${base}?dominio=manejo`);
    expect(porDominio.body.itens.map((e) => e.titulo)).toEqual(["Banho noturno", "Trato"]);

    // 23:30 de 05/04 em Brasilia ja e 06/04 em UTC: o filtro respeita o dia local
    const porPeriodo = await api(proprietario.token).get(`${base}?de=2026-04-02&ate=2026-04-05`);
    expect(porPeriodo.body.itens.map((e) => e.titulo)).toEqual(["Banho noturno", "Treino 3", "Treino 2", "Trato"]);

    const porAutor = await api(proprietario.token).get(`${base}?autorId=${treinador.id}`);
    expect(porAutor.body.total).toBe(3);
  });

  test("paginacao com total do conjunto filtrado", async () => {
    const { proprietario, animal } = await cenarioComCincoEventos();
    const pagina = await api(proprietario.token).get(`/animais/${animal.id}/eventos?limite=2&deslocamento=2`);

    expect(pagina.body.total).toBe(5);
    expect(pagina.body.limite).toBe(2);
    expect(pagina.body.deslocamento).toBe(2);
    expect(pagina.body.itens.map((e) => e.titulo)).toEqual(["Treino 2", "Trato"]);
  });

  test("filtros invalidos respondem 422", async () => {
    const { proprietario, animal } = await montarCenario();
    const base = `/animais/${animal.id}/eventos`;
    for (const consulta of ["dominio=financeiro", "de=2026-02-30", "limite=0", "limite=500", "autorId=abc", "de=2026-05-01&ate=2026-04-01"]) {
      const resposta = await api(proprietario.token).get(`${base}?${consulta}`);
      expect(resposta.status).toBe(422);
    }
  });
});

describe("CT13 - edicao de evento por quem nao e seu autor (RF15)", () => {
  test("responde 403 e registra a negacao", async () => {
    const { proprietario, treinador, animal } = await montarCenario();
    const evento = await registrarEvento(proprietario, animal.id, novoEvento("treinamento"));

    // treinador tem E em treinamento, mas E e editar o proprio registro
    const resposta = await api(treinador.token).patch(`/eventos/${evento.id}`).send({ titulo: "Alterado" });

    expect(resposta.status).toBe(403);
    expect(resposta.body).toEqual({ erro: "Somente quem registrou pode alterar este registro." });
    expect(await registrosDeAuditoria({ usuarioId: treinador.id, motivo: "nao_autor", entidadeId: evento.id })).toHaveLength(1);

    const inalterado = await prisma.evento.findUnique({ where: { id: evento.id } });
    expect(inalterado.titulo).toBe("Treino");
    expect(inalterado.versao).toBe(1);
  });

  test("papel sem E no dominio e recusado pelo middleware", async () => {
    const { veterinario, proprietario, animal } = await montarCenario();
    const evento = await registrarEvento(veterinario, animal.id, novoEvento("saude"));
    const resposta = await api(proprietario.token).patch(`/eventos/${evento.id}`).send({ titulo: "Alterado" });
    expect(resposta.status).toBe(403);
    expect(await registrosDeAuditoria({ usuarioId: proprietario.id, motivo: "papel_insuficiente" })).toHaveLength(1);
  });
});

describe("edicao pelo autor com historico (RF15)", () => {
  test("incrementa a versao e guarda o conteudo anterior em evento_historico", async () => {
    const { treinador, animal } = await montarCenario();
    const evento = await registrarEvento(treinador, animal.id, novoEvento("treinamento", { detalhe: { duracaoMin: 30 } }));

    const resposta = await api(treinador.token)
      .patch(`/eventos/${evento.id}`)
      .send({ versao: 1, titulo: "Treino revisado", detalhe: { duracaoMin: 45 } });

    expect(resposta.status).toBe(200);
    expect(resposta.body).toMatchObject({ titulo: "Treino revisado", versao: 2, detalhe: { duracaoMin: 45, tipoExercicio: "tambor" } });

    const historico = await prisma.eventoHistorico.findMany({ where: { eventoId: evento.id } });
    expect(historico).toHaveLength(1);
    expect(historico[0]).toMatchObject({ versaoAnterior: 1, alteradoPor: treinador.id });
    expect(historico[0].conteudoAnterior).toMatchObject({ titulo: "Treino", versao: 1, detalhe: { duracaoMin: 30 } });
    expect(await registrosDeAuditoria({ acao: "evento_editado", entidadeId: evento.id })).toHaveLength(1);
  });

  test("versao desatualizada responde 409 sem alterar nada", async () => {
    const { treinador, animal } = await montarCenario();
    const evento = await registrarEvento(treinador, animal.id, novoEvento("treinamento"));
    await api(treinador.token).patch(`/eventos/${evento.id}`).send({ titulo: "Primeira edicao" });

    const resposta = await api(treinador.token).patch(`/eventos/${evento.id}`).send({ versao: 1, titulo: "Edicao antiga" });
    expect(resposta.status).toBe(409);
    expect((await prisma.evento.findUnique({ where: { id: evento.id } })).titulo).toBe("Primeira edicao");
  });

  test("alterar a data de retorno ajusta o lembrete; remove-la cancela", async () => {
    const { veterinario, animal } = await montarCenario();
    const evento = await registrarEvento(veterinario, animal.id, novoEvento("saude", { detalhe: { dataRetorno: "2026-09-14" } }));

    await api(veterinario.token).patch(`/eventos/${evento.id}`).send({ detalhe: { dataRetorno: "2026-10-01" } });
    let lembrete = await prisma.lembrete.findUnique({ where: { id: evento.lembreteGerado.id } });
    expect(lembrete.dataPrevista.toISOString().slice(0, 10)).toBe("2026-10-01");
    expect(lembrete.status).toBe("pendente");

    await api(veterinario.token).patch(`/eventos/${evento.id}`).send({ detalhe: { dataRetorno: null } });
    lembrete = await prisma.lembrete.findUnique({ where: { id: evento.lembreteGerado.id } });
    expect(lembrete.status).toBe("cancelado");
  });

  test("dominio nao pode ser trocado e campo obrigatorio nao pode ser apagado", async () => {
    const { treinador, animal } = await montarCenario();
    const evento = await registrarEvento(treinador, animal.id, novoEvento("treinamento"));

    const troca = await api(treinador.token).patch(`/eventos/${evento.id}`).send({ dominio: "competicao" });
    expect(troca.status).toBe(422);
    const apagar = await api(treinador.token).patch(`/eventos/${evento.id}`).send({ titulo: "" });
    expect(apagar.status).toBe(422);
    expect(apagar.body.erro).toBe("Informe o título.");
  });
});

describe("CT14 - exclusao logica pelo proprietario (RF16)", () => {
  test("evento some da linha do tempo e permanece na base", async () => {
    const { proprietario, treinador, animal } = await montarCenario();
    const evento = await registrarEvento(treinador, animal.id, novoEvento("treinamento"));

    const exclusao = await api(proprietario.token).delete(`/eventos/${evento.id}`);
    expect(exclusao.status).toBe(204);

    const linha = await api(proprietario.token).get(`/animais/${animal.id}/eventos`);
    expect(linha.body.total).toBe(0);
    expect(linha.body.itens).toEqual([]);

    const naBase = await prisma.evento.findUnique({ where: { id: evento.id }, include: { treinamento: true } });
    expect(naBase).not.toBeNull();
    expect(naBase.excluidoEm).toBeInstanceOf(Date);
    expect(naBase.treinamento.tipoExercicio).toBe("tambor");
    expect(await registrosDeAuditoria({ acao: "evento_excluido", entidadeId: evento.id, usuarioId: proprietario.id })).toHaveLength(1);
  });

  test("autor tambem exclui; terceiro com leitura nao exclui", async () => {
    const { manejo, veterinario, animal } = await montarCenario();
    const doManejo = await registrarEvento(manejo, animal.id, novoEvento("manejo"));

    const terceiro = await api(veterinario.token).delete(`/eventos/${doManejo.id}`);
    expect(terceiro.status).toBe(403);
    expect(await registrosDeAuditoria({ usuarioId: veterinario.id, motivo: "nao_autor_nem_proprietario" })).toHaveLength(1);

    const autor = await api(manejo.token).delete(`/eventos/${doManejo.id}`);
    expect(autor.status).toBe(204);
  });

  test("evento excluido nao pode ser editado nem excluido de novo; lembrete em aberto e cancelado", async () => {
    const { proprietario, veterinario, animal } = await montarCenario();
    const evento = await registrarEvento(veterinario, animal.id, novoEvento("saude", { detalhe: { dataRetorno: "2026-09-14" } }));

    await api(proprietario.token).delete(`/eventos/${evento.id}`);

    expect((await api(veterinario.token).patch(`/eventos/${evento.id}`).send({ titulo: "x" })).status).toBe(404);
    expect((await api(proprietario.token).delete(`/eventos/${evento.id}`)).status).toBe(404);
    const lembrete = await prisma.lembrete.findUnique({ where: { id: evento.lembreteGerado.id } });
    expect(lembrete.status).toBe("cancelado");
  });
});
