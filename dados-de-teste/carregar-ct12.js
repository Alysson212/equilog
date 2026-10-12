// Massa adicional do CT12 (especificacao, secao 8; RNF05): 500 eventos no
// animal "Estrela do Sul", 125 por dominio, um por dia retroativamente a partir
// de 11/10/2026. Pressupoe a base reinicializada (reinicializar.js).
//
// Uso: node dados-de-teste/carregar-ct12.js

const { randomUUID } = require("node:crypto");
const { PrismaClient, exigirBancoLocal } = require("./comum");

const QUANTIDADE = 500;
const PREFIXO = "CT12";

const MODELOS = {
  saude: { autor: "veterinario@sessao.equilog", tipo: "exame", subtipo: "eventoSaude", detalhe: (n) => ({ procedimento: `exame de rotina ${n}` }) },
  manejo: { autor: "manejo@sessao.equilog", tipo: "alimentacao", subtipo: "eventoManejo", detalhe: () => ({ categoria: "racao", quantidade: 4.5, unidade: "kg" }) },
  treinamento: { autor: "treinador@sessao.equilog", tipo: "trabalho de tambor", subtipo: "eventoTreinamento", detalhe: () => ({ tipoExercicio: "percurso completo", duracaoMin: 40, intensidade: "moderada", piso: "areia" }) },
  competicao: { autor: "treinador@sessao.equilog", tipo: "simulado de treino", subtipo: "eventoCompeticao", detalhe: (n) => ({ nomeProva: `Simulado ${n}`, local: "Paraisópolis", tempoSegundos: 16 + (n % 100) / 100 }) },
};
const DOMINIOS = Object.keys(MODELOS);

async function main() {
  exigirBancoLocal();
  const prisma = new PrismaClient();
  try {
    const animal = await prisma.animal.findFirst({ where: { nome: "Estrela do Sul" } });
    if (!animal) throw new Error("Animal 'Estrela do Sul' nao encontrado: rode reinicializar.js antes.");
    const jaCarregados = await prisma.evento.count({ where: { animalId: animal.id, titulo: { startsWith: PREFIXO } } });
    if (jaCarregados > 0) throw new Error(`A massa do CT12 ja esta carregada (${jaCarregados} eventos). Reinicialize a base antes.`);

    const usuarios = Object.fromEntries((await prisma.usuario.findMany()).map((u) => [u.email, u.id]));
    const tipos = await prisma.tipoEvento.findMany();
    const fim = new Date("2026-10-11T12:00:00-03:00").getTime();

    const eventos = [];
    const subtipos = Object.fromEntries(DOMINIOS.map((d) => [d, []]));
    for (let n = 1; n <= QUANTIDADE; n += 1) {
      const dominio = DOMINIOS[n % DOMINIOS.length];
      const modelo = MODELOS[dominio];
      const id = randomUUID();
      eventos.push({
        id,
        animalId: animal.id,
        tipoEventoId: tipos.find((t) => t.dominio === dominio && t.nome === modelo.tipo).id,
        dataEvento: new Date(fim - n * 24 * 60 * 60 * 1000),
        titulo: `${PREFIXO} registro ${n}`,
        registradoPor: usuarios[modelo.autor],
      });
      subtipos[dominio].push({ eventoId: id, ...modelo.detalhe(n) });
    }

    await prisma.$transaction(async (tx) => {
      await tx.evento.createMany({ data: eventos });
      for (const dominio of DOMINIOS) {
        await tx[MODELOS[dominio].subtipo].createMany({ data: subtipos[dominio] });
      }
    });

    const total = await prisma.evento.count({ where: { animalId: animal.id, excluidoEm: null } });
    console.log(`Carregados ${QUANTIDADE} eventos do CT12. "${animal.nome}" tem agora ${total} eventos.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((erro) => {
  console.error(erro.message);
  process.exitCode = 1;
});
