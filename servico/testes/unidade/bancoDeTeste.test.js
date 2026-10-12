// A suite so roda no banco equilog_teste (protecao da base de desenvolvimento).

const { exigirBancoDeTeste, confirmarConexaoDeTeste } = require("../configuracao/bancoDeTeste");

describe("trava do banco de testes", () => {
  const original = process.env.DATABASE_URL_TESTE;
  afterEach(() => {
    process.env.DATABASE_URL_TESTE = original;
  });

  test.each(["equilog", "equilog_teste2", "outro_teste", "teste_equilog_teste"])("recusa o banco %s", (nome) => {
    process.env.DATABASE_URL_TESTE = `postgresql://u:s@127.0.0.1:5432/${nome}?schema=public`;
    expect(() => exigirBancoDeTeste()).toThrow(/Abortado/);
  });

  test("aceita exatamente equilog_teste", () => {
    process.env.DATABASE_URL_TESTE = "postgresql://u:s@127.0.0.1:5432/equilog_teste?schema=public";
    expect(exigirBancoDeTeste()).toContain("/equilog_teste?");
  });

  test("aborta se a conexao efetiva for outro banco", async () => {
    const conexaoFalsa = { $queryRaw: async () => [{ banco: "equilog" }] };
    await expect(confirmarConexaoDeTeste(conexaoFalsa)).rejects.toThrow(/Abortado/);
  });
});
