// Autenticacao: CT01 e CT02 (RF02), renovacao (RF03), cadastro (RF01) e RNF01.

const {
  api,
  prisma,
  limparBase,
  criarUsuario,
  registrosDeAuditoria,
  decodificarToken,
  encerrar,
  SENHA_PADRAO,
} = require("./apoio");

beforeEach(limparBase);
afterAll(encerrar);

describe("CT01 - autenticacao com credenciais validas (RF02)", () => {
  test("emite token de acesso e de renovacao, sem papeis no token", async () => {
    await api().post("/usuarios").send({ nome: "Ana", email: "ana@teste.equilog", senha: SENHA_PADRAO });

    const resposta = await api().post("/auth/login").send({ email: "ana@teste.equilog", senha: SENHA_PADRAO });

    expect(resposta.status).toBe(200);
    expect(resposta.body.tokenAcesso).toEqual(expect.any(String));
    expect(resposta.body.tokenRenovacao).toEqual(expect.any(String));
    expect(resposta.body.usuario).toEqual({ id: expect.any(String), nome: "Ana", email: "ana@teste.equilog" });

    const acesso = decodificarToken(resposta.body.tokenAcesso);
    expect(Object.keys(acesso).sort()).toEqual(["exp", "iat", "sub"]);
    expect(acesso.exp - acesso.iat).toBe(15 * 60);

    const renovacao = decodificarToken(resposta.body.tokenRenovacao);
    expect(Object.keys(renovacao).sort()).toEqual(["exp", "iat", "sub"]);
    expect(renovacao.exp - renovacao.iat).toBe(30 * 24 * 60 * 60);

    const autenticada = await api(resposta.body.tokenAcesso).get("/animais");
    expect(autenticada.status).toBe(200);
  });

  test("e-mail e comparado sem diferenciar maiusculas", async () => {
    await api().post("/usuarios").send({ nome: "Ana", email: "Ana@Teste.Equilog", senha: SENHA_PADRAO });
    const resposta = await api().post("/auth/login").send({ email: "ANA@teste.equilog", senha: SENHA_PADRAO });
    expect(resposta.status).toBe(200);
  });
});

describe("CT02 - autenticacao com senha incorreta (RF02)", () => {
  test("responde 401 sem indicar qual campo esta errado", async () => {
    const usuario = await criarUsuario("Bruno");

    const senhaErrada = await api().post("/auth/login").send({ email: usuario.email, senha: "outra-senha-qualquer" });
    const emailInexistente = await api().post("/auth/login").send({ email: "ninguem@teste.equilog", senha: SENHA_PADRAO });

    expect(senhaErrada.status).toBe(401);
    expect(emailInexistente.status).toBe(401);
    // mesma resposta nos dois casos: nao revela se o e-mail existe
    expect(senhaErrada.body).toEqual({ erro: "E-mail ou senha não conferem." });
    expect(emailInexistente.body).toEqual(senhaErrada.body);
    expect(senhaErrada.body.tokenAcesso).toBeUndefined();
  });

  test("registra as tentativas negadas na auditoria, inclusive para e-mail inexistente", async () => {
    const usuario = await criarUsuario("Bruno");
    await api().post("/auth/login").send({ email: usuario.email, senha: "outra-senha-qualquer" });
    await api().post("/auth/login").send({ email: "ninguem@teste.equilog", senha: SENHA_PADRAO });

    const negacoes = await registrosDeAuditoria({ acao: "login_negado" });
    expect(negacoes).toHaveLength(2);
    expect(negacoes[0]).toMatchObject({ usuarioId: usuario.id, identificadorTentativa: null, motivo: "senha_incorreta" });
    expect(negacoes[1]).toMatchObject({
      usuarioId: null,
      identificadorTentativa: "ninguem@teste.equilog",
      motivo: "usuario_inexistente",
    });
  });
});

describe("renovacao do token de acesso (RF03)", () => {
  test("emite novo token de acesso sem nova digitacao de senha", async () => {
    const usuario = await criarUsuario("Carla");
    const resposta = await api().post("/auth/refresh").send({ tokenRenovacao: usuario.tokenRenovacao });

    expect(resposta.status).toBe(200);
    expect(decodificarToken(resposta.body.tokenAcesso).sub).toBe(usuario.id);
  });

  test("recusa token de acesso no lugar do token de renovacao", async () => {
    const usuario = await criarUsuario("Carla");
    const resposta = await api().post("/auth/refresh").send({ tokenRenovacao: usuario.token });
    expect(resposta.status).toBe(401);
  });

  test("recusa token de renovacao no lugar do token de acesso", async () => {
    const usuario = await criarUsuario("Carla");
    const resposta = await api(usuario.tokenRenovacao).get("/animais");
    expect(resposta.status).toBe(401);
  });
});

describe("rotas protegidas sem credencial", () => {
  test("responde 401 e registra a negacao", async () => {
    const semToken = await api().get("/animais");
    const tokenInvalido = await api("abc.def.ghi").get("/animais");

    expect(semToken.status).toBe(401);
    expect(tokenInvalido.status).toBe(401);
    const negacoes = await registrosDeAuditoria({ acao: "acesso_negado" });
    expect(negacoes.map((n) => n.motivo)).toEqual(["token_ausente", "token_invalido"]);
  });
});

describe("cadastro de usuario (RF01, RNF01, RNF12)", () => {
  test("armazena apenas o resumo bcrypt com custo 12 e nunca devolve a senha", async () => {
    const resposta = await api()
      .post("/usuarios")
      .send({ nome: "Davi", email: "davi@teste.equilog", telefone: "(35) 99999-0000", senha: SENHA_PADRAO });

    expect(resposta.status).toBe(201);
    expect(resposta.body).toEqual({
      id: expect.any(String),
      nome: "Davi",
      email: "davi@teste.equilog",
      telefone: "(35) 99999-0000",
      codigoRecuperacao: expect.stringMatching(/^[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/),
    });

    const gravado = await prisma.usuario.findUnique({ where: { id: resposta.body.id } });
    expect(gravado.senhaHash).toMatch(/^\$2[ab]\$12\$/);
    expect(gravado.senhaHash).not.toContain(SENHA_PADRAO);
    // o codigo de recuperacao tambem so existe no banco como resumo bcrypt
    expect(gravado.codigoRecuperacaoHash).toMatch(/^\$2[ab]\$12\$/);
    expect(gravado.codigoRecuperacaoHash).not.toContain(resposta.body.codigoRecuperacao);
  });

  test("responde 422 com mensagem compreensivel quando falta dado", async () => {
    const resposta = await api().post("/usuarios").send({ email: "x@teste.equilog", senha: "curta" });

    expect(resposta.status).toBe(422);
    expect(resposta.body.campos).toEqual([
      { campo: "nome", mensagem: "Informe o nome." },
      { campo: "senha", mensagem: "A senha deve ter pelo menos 8 caracteres." },
    ]);
  });

  test("recusa e-mail ja cadastrado", async () => {
    await api().post("/usuarios").send({ nome: "Eva", email: "eva@teste.equilog", senha: SENHA_PADRAO });
    const repetido = await api().post("/usuarios").send({ nome: "Eva 2", email: "EVA@teste.equilog", senha: SENHA_PADRAO });
    expect(repetido.status).toBe(422);
    expect(repetido.body.erro).toBe("Já existe uma conta com este e-mail.");
  });

  test("corpo que nao e JSON valido responde 400", async () => {
    const resposta = await api().post("/usuarios").set("Content-Type", "application/json").send("{nome:");
    expect(resposta.status).toBe(400);
    expect(resposta.body).toEqual({ erro: "Não foi possível ler os dados enviados." });
  });
});

describe("recuperacao de senha pelo codigo do cadastro (decisao 9.7)", () => {
  const NOVA_SENHA = "outra-senha-segura-456";

  async function cadastrar(nome) {
    const email = `${nome.toLowerCase()}@teste.equilog`;
    const resposta = await api().post("/usuarios").send({ nome, email, senha: SENHA_PADRAO });
    return { id: resposta.body.id, email, codigo: resposta.body.codigoRecuperacao };
  }

  test("com o codigo certo troca a senha, devolve novo codigo e o anterior deixa de valer", async () => {
    const usuario = await cadastrar("Gil");

    // digitado em minusculas e sem hifens, como a pessoa poderia anotar
    const digitado = usuario.codigo.toLowerCase().replace(/-/g, " ");
    const resposta = await api()
      .post("/auth/recuperar-senha")
      .send({ email: usuario.email.toUpperCase(), codigoRecuperacao: digitado, novaSenha: NOVA_SENHA });

    expect(resposta.status).toBe(200);
    expect(Object.keys(resposta.body)).toEqual(["codigoRecuperacao"]);
    expect(resposta.body.codigoRecuperacao).not.toBe(usuario.codigo);

    expect((await api().post("/auth/login").send({ email: usuario.email, senha: SENHA_PADRAO })).status).toBe(401);
    expect((await api().post("/auth/login").send({ email: usuario.email, senha: NOVA_SENHA })).status).toBe(200);

    const reuso = await api()
      .post("/auth/recuperar-senha")
      .send({ email: usuario.email, codigoRecuperacao: usuario.codigo, novaSenha: "mais-uma-senha-789" });
    expect(reuso.status).toBe(401);

    const novoCodigo = await api()
      .post("/auth/recuperar-senha")
      .send({ email: usuario.email, codigoRecuperacao: resposta.body.codigoRecuperacao, novaSenha: "mais-uma-senha-789" });
    expect(novoCodigo.status).toBe(200);

    const redefinicoes = await registrosDeAuditoria({ acao: "senha_redefinida" });
    expect(redefinicoes).toHaveLength(2);
    expect(redefinicoes[0]).toMatchObject({ usuarioId: usuario.id, entidade: "usuario", entidadeId: usuario.id });
  });

  test("recusa com a mesma resposta para codigo errado, e-mail inexistente, conta sem codigo e conta inativa", async () => {
    const certo = await cadastrar("Hugo");
    const semCodigo = await cadastrar("Iara");
    await prisma.usuario.update({ where: { id: semCodigo.id }, data: { codigoRecuperacaoHash: null } });
    const inativo = await cadastrar("Joel");
    await prisma.usuario.update({ where: { id: inativo.id }, data: { ativo: false } });

    const tentativas = [
      { email: certo.email, codigoRecuperacao: "AAAA-BBBB-CCCC" },
      { email: "ninguem@teste.equilog", codigoRecuperacao: certo.codigo },
      { email: semCodigo.email, codigoRecuperacao: semCodigo.codigo },
      { email: inativo.email, codigoRecuperacao: inativo.codigo },
    ];
    for (const tentativa of tentativas) {
      const resposta = await api().post("/auth/recuperar-senha").send({ ...tentativa, novaSenha: NOVA_SENHA });
      expect(resposta.status).toBe(401);
      expect(resposta.body).toEqual({ erro: "E-mail ou código de recuperação não conferem." });
    }

    const negacoes = await registrosDeAuditoria({ acao: "recuperacao_negada" });
    expect(negacoes.map((n) => n.motivo)).toEqual(["codigo_incorreto", "usuario_inexistente", "sem_codigo", "conta_inativa"]);
    expect(negacoes[1]).toMatchObject({ usuarioId: null, identificadorTentativa: "ninguem@teste.equilog" });

    // nenhuma senha foi alterada
    expect((await api().post("/auth/login").send({ email: certo.email, senha: SENHA_PADRAO })).status).toBe(200);
    expect(await registrosDeAuditoria({ acao: "senha_redefinida" })).toHaveLength(0);
  });

  test("valida a nova senha com as regras do cadastro, sem consumir o codigo", async () => {
    const usuario = await cadastrar("Kika");

    const curta = await api()
      .post("/auth/recuperar-senha")
      .send({ email: usuario.email, codigoRecuperacao: usuario.codigo, novaSenha: "curta" });
    expect(curta.status).toBe(422);
    expect(curta.body.campos).toEqual([{ campo: "novaSenha", mensagem: "A nova senha deve ter pelo menos 8 caracteres." }]);

    const vazio = await api().post("/auth/recuperar-senha").send({});
    expect(vazio.status).toBe(422);
    expect(vazio.body.campos.map((c) => c.campo)).toEqual(["email", "codigoRecuperacao", "novaSenha"]);

    const valida = await api()
      .post("/auth/recuperar-senha")
      .send({ email: usuario.email, codigoRecuperacao: usuario.codigo, novaSenha: NOVA_SENHA });
    expect(valida.status).toBe(200);
  });

  test("duas recuperacoes simultaneas com o mesmo codigo: so uma vale", async () => {
    const usuario = await cadastrar("Lia");
    const pedido = (novaSenha) =>
      api().post("/auth/recuperar-senha").send({ email: usuario.email, codigoRecuperacao: usuario.codigo, novaSenha });

    const respostas = await Promise.all([pedido("primeira-senha-111"), pedido("segunda-senha-222")]);

    expect(respostas.map((r) => r.status).sort()).toEqual([200, 401]);
    expect(await registrosDeAuditoria({ acao: "senha_redefinida" })).toHaveLength(1);
  });
});
