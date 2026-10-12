// A autorizacao do POST /sincronizacao/lote decide igual ao middleware
// autorizar (RNF03), e toda recusa no lote vai para a trilha de auditoria com
// o motivo correspondente (RNF04). Tambem: GET /tipos-evento.

const { randomUUID } = require("node:crypto");
const {
  api,
  prisma,
  limparBase,
  montarCenario,
  criarUsuario,
  criarAnimal,
  conceder,
  novoEvento,
  registrosDeAuditoria,
  encerrar,
} = require("./apoio");

beforeEach(limparBase);
afterAll(encerrar);

const PAPEIS = ["proprietario", "veterinario", "treinador", "manejo"];
const DOMINIOS = ["saude", "manejo", "treinamento", "competicao"];

function itemDeLote(animalId, dominio, extra = {}) {
  return { ...novoEvento(dominio, extra), animalId, versao: 1 };
}

async function enviarLote(usuario, itens) {
  const resposta = await api(usuario.token).post("/sincronizacao/lote").send(itens);
  expect(resposta.status).toBe(200);
  return resposta.body.resultados;
}

describe("autorizacao do lote igual a do middleware autorizar", () => {
  test("responsavel pelo manejo enviando evento de saude: recusado, como no middleware", async () => {
    const { manejo, animal } = await montarCenario();

    const direto = await api(manejo.token).post(`/animais/${animal.id}/eventos`).send(novoEvento("saude"));
    const [noLote] = await enviarLote(manejo, [itemDeLote(animal.id, "saude")]);

    expect(direto.status).toBe(403);
    expect(noLote).toMatchObject({ situacao: "recusado", motivo: "papel_insuficiente" });
    const negacoes = await registrosDeAuditoria({ usuarioId: manejo.id, acao: "acesso_negado" });
    expect(negacoes.map((n) => n.motivo)).toEqual(["papel_insuficiente", "papel_insuficiente"]);
    expect(await prisma.evento.count()).toBe(0);
  });

  test("veterinario enviando evento de competicao: recusado, como no middleware", async () => {
    const { veterinario, animal } = await montarCenario();

    const direto = await api(veterinario.token).post(`/animais/${animal.id}/eventos`).send(novoEvento("competicao"));
    const [noLote] = await enviarLote(veterinario, [itemDeLote(animal.id, "competicao")]);

    expect(direto.status).toBe(403);
    expect(noLote).toMatchObject({ situacao: "recusado", motivo: "papel_insuficiente" });
    expect(await prisma.evento.count()).toBe(0);
  });

  test("lote com itens de dois animais e vinculo em um so: sincroniza apenas o permitido", async () => {
    const dono = await criarUsuario("Dono");
    const outroDono = await criarUsuario("OutroDono");
    const manejo = await criarUsuario("Manejo");
    const comVinculo = await criarAnimal(dono, { nome: "Com vinculo" });
    const semVinculo = await criarAnimal(outroDono, { nome: "Sem vinculo" });
    await conceder(dono, comVinculo.id, manejo, "manejo");

    const permitido = itemDeLote(comVinculo.id, "manejo");
    const negado = itemDeLote(semVinculo.id, "manejo");
    const resultados = await enviarLote(manejo, [permitido, negado]);

    expect(resultados).toEqual([
      { id: permitido.id, situacao: "sincronizado", versaoServidor: 1 },
      { id: negado.id, situacao: "recusado", versaoServidor: null, motivo: "sem_vinculo" },
    ]);
    expect(await prisma.evento.findMany({ select: { id: true } })).toEqual([{ id: permitido.id }]);

    // o middleware decide o mesmo para o animal sem vinculo
    const direto = await api(manejo.token).post(`/animais/${semVinculo.id}/eventos`).send(novoEvento("manejo"));
    expect(direto.status).toBe(403);
    const negacoes = await registrosDeAuditoria({ usuarioId: manejo.id, motivo: "sem_vinculo" });
    expect(negacoes.map((n) => n.entidadeId)).toEqual([semVinculo.id, semVinculo.id]);
  });

  test("mesma decisao nas 16 combinacoes de papel e dominio", async () => {
    const cenario = await montarCenario();
    const divergencias = [];

    for (const papel of PAPEIS) {
      for (const dominio of DOMINIOS) {
        const usuario = cenario[papel];
        const direto = await api(usuario.token).post(`/animais/${cenario.animal.id}/eventos`).send(novoEvento(dominio));
        const [noLote] = await enviarLote(usuario, [itemDeLote(cenario.animal.id, dominio)]);

        const middlewarePermitiu = direto.status === 201;
        const lotePermitiu = noLote.situacao === "sincronizado";
        if (middlewarePermitiu !== lotePermitiu || (direto.status !== 201 && direto.status !== 403)) {
          divergencias.push({ papel, dominio, middleware: direto.status, lote: noLote.situacao });
        }
      }
    }

    expect(divergencias).toEqual([]);
    // 7 combinacoes com C na matriz (saude: veterinario; manejo: proprietario e
    // manejo; treinamento e competicao: proprietario e treinador), dois eventos cada
    expect(await prisma.evento.count()).toBe(7 * 2);
  });

  test("usuario sem nenhum vinculo: recusado nos dois caminhos", async () => {
    const { animal } = await montarCenario();
    const estranho = await criarUsuario("Estranho");

    const direto = await api(estranho.token).post(`/animais/${animal.id}/eventos`).send(novoEvento("manejo"));
    const [noLote] = await enviarLote(estranho, [itemDeLote(animal.id, "manejo")]);

    expect(direto.status).toBe(403);
    expect(noLote).toMatchObject({ situacao: "recusado", motivo: "sem_vinculo" });
  });
});

describe("toda recusa no lote vai para a trilha de auditoria (RNF04)", () => {
  test.each([
    ["sem_vinculo", "acesso_negado"],
    ["papel_insuficiente", "acesso_negado"],
    ["id_de_outro_registro", "acesso_negado"],
    ["dados_invalidos (envelope)", "sincronizacao_recusada"],
    ["dados_invalidos (dominio)", "sincronizacao_recusada"],
    ["dados_invalidos (item nao e objeto)", "sincronizacao_recusada"],
  ])("recusa por %s gera registro com o motivo", async (caso, acaoEsperada) => {
    const { proprietario, manejo, veterinario, animal } = await montarCenario();
    const estranho = await criarUsuario("Estranho");
    const motivo = caso.split(" ")[0];

    const preparar = {
      sem_vinculo: async () => [estranho, [itemDeLote(animal.id, "manejo")]],
      papel_insuficiente: async () => [veterinario, [itemDeLote(animal.id, "competicao")]],
      id_de_outro_registro: async () => {
        const item = itemDeLote(animal.id, "manejo");
        await enviarLote(manejo, [item]);
        return [proprietario, [item]];
      },
      "dados_invalidos (envelope)": async () => [manejo, [{ id: randomUUID(), dominio: "manejo" }]],
      "dados_invalidos (dominio)": async () => [manejo, [itemDeLote(animal.id, "manejo", { titulo: "" })]],
      "dados_invalidos (item nao e objeto)": async () => [manejo, ["texto"]],
    }[caso];

    const [usuario, itens] = await preparar();
    const [resultado] = await enviarLote(usuario, itens);

    expect(resultado).toMatchObject({ situacao: "recusado", motivo });
    const registros = await registrosDeAuditoria({ usuarioId: usuario.id, entidade: "sincronizacao", motivo });
    expect(registros).toHaveLength(1);
    expect(registros[0].acao).toBe(acaoEsperada);
  });

  test("lote com tres recusas gera tres registros, um por item", async () => {
    const { veterinario, animal } = await montarCenario();
    const resultados = await enviarLote(veterinario, [
      itemDeLote(animal.id, "competicao"),
      itemDeLote(animal.id, "manejo"),
      "invalido",
      itemDeLote(animal.id, "saude"),
    ]);
    expect(resultados.map((r) => r.situacao)).toEqual(["recusado", "recusado", "recusado", "sincronizado"]);
    const registros = await registrosDeAuditoria({ usuarioId: veterinario.id, entidade: "sincronizacao" });
    expect(registros.map((r) => r.motivo)).toEqual(["papel_insuficiente", "papel_insuficiente", "dados_invalidos"]);
  });
});

describe("GET /tipos-evento", () => {
  test("devolve os 27 tipos da carga inicial com dominio, nome e exige_retorno", async () => {
    const usuario = await criarUsuario("Qualquer");
    const resposta = await api(usuario.token).get("/tipos-evento");

    expect(resposta.status).toBe(200);
    expect(resposta.body.itens).toHaveLength(27);
    expect(resposta.body.itens[0]).toEqual({ dominio: expect.any(String), nome: expect.any(String), exigeRetorno: expect.any(Boolean) });
    expect(resposta.body.itens.filter((t) => t.exigeRetorno).map((t) => t.nome).sort()).toEqual(
      ["procedimento odontologico", "vacinacao", "vermifugacao"],
    );
    const porDominio = resposta.body.itens.reduce((acc, t) => ({ ...acc, [t.dominio]: (acc[t.dominio] ?? 0) + 1 }), {});
    expect(porDominio).toEqual({ competicao: 4, manejo: 8, saude: 9, treinamento: 6 });
  });

  test("exige autenticacao", async () => {
    expect((await api().get("/tipos-evento")).status).toBe(401);
  });
});
