// Reinicializa a base para o estado padronizado das sessoes de avaliacao
// (especificacao, secao 8; TCC, secao 3.4.3, etapa a):
//   - 2 animais cadastrados;
//   - 30 eventos distribuidos entre os quatro dominios;
//   - um usuario de teste por papel. O participante recebe a credencial do
//     papel em que atua; os outros tres representam os papeis distintos do dele.
//
// APAGA todos os dados de uso (usuarios, animais, eventos, vinculos,
// lembretes, anexos e auditoria). Preserva papel, permissao e tipo_evento.
//
// Uso, a partir da raiz do repositorio:
//   node dados-de-teste/reinicializar.js --confirmar
// Senha dos usuarios de teste: variavel SENHA_SESSAO ou "sessao-equilog-2026".

const { randomUUID } = require("node:crypto");
const { PrismaClient, bcrypt, exigirBancoLocal } = require("./comum");

const SENHA = process.env.SENHA_SESSAO ?? "sessao-equilog-2026";

const USUARIOS = [
  { chave: "proprietario", nome: "Paula Proprietária", email: "proprietario@sessao.equilog", telefone: "(35) 90000-0001" },
  { chave: "veterinario", nome: "Vítor Veterinário", email: "veterinario@sessao.equilog", telefone: "(35) 90000-0002" },
  { chave: "treinador", nome: "Tiago Treinador", email: "treinador@sessao.equilog", telefone: "(35) 90000-0003" },
  { chave: "manejo", nome: "Marta Manejo", email: "manejo@sessao.equilog", telefone: "(35) 90000-0004" },
];

const ANIMAIS = [
  { chave: "estrela", nome: "Estrela do Sul", registroAssociacao: "QM-482913", dataNascimento: "2017-09-14", sexo: "F", pelagem: "Alazã" },
  { chave: "trovao", nome: "Trovão", registroAssociacao: "QM-519027", dataNascimento: "2016-11-02", sexo: "C", pelagem: "Tordilho" },
];

// 30 eventos: 8 de saude, 8 de manejo, 8 de treinamento e 6 de competicao.
// [animal, autor, dominio, tipo, data, titulo, detalhe]
const EVENTOS = [
  ["estrela", "veterinario", "saude", "vacinacao", "2026-07-03T09:00:00-03:00", "Vacina contra influenza equina", { procedimento: "vacinacao", produto: "Vacina influenza equina", dose: "1 mL", via: "intramuscular", profissional: "Vítor Veterinário", dataRetorno: "2027-01-03" }],
  ["estrela", "veterinario", "saude", "vermifugacao", "2026-07-20T08:30:00-03:00", "Vermifugação", { procedimento: "vermifugacao", produto: "Vermífugo oral", dose: "1 seringa", via: "oral", dataRetorno: "2026-11-20" }],
  ["estrela", "veterinario", "saude", "exame", "2026-08-11T10:00:00-03:00", "Exame de sangue de rotina", { procedimento: "hemograma", profissional: "Vítor Veterinário" }],
  ["estrela", "veterinario", "saude", "procedimento odontologico", "2026-09-05T14:00:00-03:00", "Correção dentária", { procedimento: "nivelamento dentario", dataRetorno: "2027-03-05" }],
  ["trovao", "veterinario", "saude", "vacinacao", "2026-07-03T10:00:00-03:00", "Vacina contra influenza equina", { procedimento: "vacinacao", produto: "Vacina influenza equina", dose: "1 mL", via: "intramuscular", dataRetorno: "2027-01-03" }],
  ["trovao", "veterinario", "saude", "consulta clinica", "2026-08-02T16:00:00-03:00", "Consulta por claudicação leve", { procedimento: "exame clinico de locomocao" }],
  ["trovao", "veterinario", "saude", "tratamento", "2026-08-03T09:00:00-03:00", "Repouso e ducha fria", { procedimento: "ducha fria em membro anterior", profissional: "Vítor Veterinário" }],
  ["trovao", "veterinario", "saude", "vermifugacao", "2026-09-18T08:00:00-03:00", "Vermifugação", { procedimento: "vermifugacao", produto: "Vermífugo oral", via: "oral", dataRetorno: "2026-12-18" }],

  ["estrela", "manejo", "manejo", "alimentacao", "2026-09-30T07:00:00-03:00", "Trato da manhã", { categoria: "racao", quantidade: 4.5, unidade: "kg" }],
  ["estrela", "manejo", "manejo", "casqueamento", "2026-08-25T09:00:00-03:00", "Casqueamento", { categoria: "casco", descricao: "Aparação dos quatro cascos" }],
  ["estrela", "manejo", "manejo", "ferrageamento", "2026-09-22T09:30:00-03:00", "Ferrageamento dianteiro", { categoria: "ferradura", descricao: "Troca das ferraduras dianteiras" }],
  ["estrela", "manejo", "manejo", "banho e higiene", "2026-10-05T17:00:00-03:00", "Banho após treino", { categoria: "higiene" }],
  ["trovao", "manejo", "manejo", "alimentacao", "2026-09-30T07:10:00-03:00", "Trato da manhã", { categoria: "racao", quantidade: 4, unidade: "kg" }],
  ["trovao", "manejo", "manejo", "suplementacao", "2026-09-30T07:15:00-03:00", "Suplemento mineral", { categoria: "suplemento", quantidade: 50, unidade: "g" }],
  ["trovao", "manejo", "manejo", "limpeza de baia", "2026-10-01T08:00:00-03:00", "Troca da cama da baia", { categoria: "baia" }],
  ["trovao", "manejo", "manejo", "transporte", "2026-10-09T05:00:00-03:00", "Transporte para a prova", { categoria: "viagem", descricao: "Saída para o parque de exposições", quantidade: 120, unidade: "km" }],

  ["estrela", "treinador", "treinamento", "trabalho de tambor", "2026-09-28T16:00:00-03:00", "Treino de tambor", { tipoExercicio: "percurso completo", duracaoMin: 40, intensidade: "alta", piso: "areia" }],
  ["estrela", "treinador", "treinamento", "condicionamento", "2026-09-29T07:30:00-03:00", "Galope de condicionamento", { tipoExercicio: "galope", duracaoMin: 30, intensidade: "moderada", piso: "grama" }],
  ["estrela", "treinador", "treinamento", "descanso", "2026-09-30T08:00:00-03:00", "Dia de descanso", { tipoExercicio: "descanso" }],
  ["estrela", "treinador", "treinamento", "trabalho de pista", "2026-10-02T16:00:00-03:00", "Trabalho de pista", { tipoExercicio: "voltas no tambor", duracaoMin: 35, intensidade: "moderada", piso: "areia" }],
  ["trovao", "treinador", "treinamento", "trabalho de tambor", "2026-09-28T17:00:00-03:00", "Treino de tambor", { tipoExercicio: "percurso parcial", duracaoMin: 30, intensidade: "moderada", piso: "areia" }],
  ["trovao", "treinador", "treinamento", "soltura em piquete", "2026-09-29T09:00:00-03:00", "Soltura em piquete", { tipoExercicio: "soltura", duracaoMin: 120, intensidade: "leve", piso: "grama" }],
  ["trovao", "treinador", "treinamento", "trabalho na esteira", "2026-10-03T07:00:00-03:00", "Esteira", { tipoExercicio: "passo e trote", duracaoMin: 25, intensidade: "leve" }],
  ["trovao", "treinador", "treinamento", "condicionamento", "2026-10-06T07:30:00-03:00", "Galope de condicionamento", { tipoExercicio: "galope", duracaoMin: 25, intensidade: "moderada", piso: "grama" }],

  ["estrela", "treinador", "competicao", "prova oficial", "2026-08-16T14:00:00-03:00", "Prova de três tambores", { nomeProva: "Copa Sul de Minas", local: "Pouso Alegre", categoria: "Aberta", tempoSegundos: 16.284, colocacao: 3, penalidade: 0 }],
  ["estrela", "proprietario", "competicao", "simulado de treino", "2026-09-06T10:00:00-03:00", "Simulado cronometrado", { nomeProva: "Simulado no haras", local: "Paraisópolis", tempoSegundos: 16.902 }],
  ["estrela", "treinador", "competicao", "prova classificatoria", "2026-10-10T15:00:00-03:00", "Classificatória", { nomeProva: "Circuito Mineiro", local: "Itajubá", categoria: "Aberta", tempoSegundos: 15.977, colocacao: 1, penalidade: 0 }],
  ["trovao", "treinador", "competicao", "prova oficial", "2026-08-16T15:00:00-03:00", "Prova de três tambores", { nomeProva: "Copa Sul de Minas", local: "Pouso Alegre", categoria: "Amador", tempoSegundos: 17.105, colocacao: 6, penalidade: 5 }],
  ["trovao", "proprietario", "competicao", "simulado de treino", "2026-09-06T11:00:00-03:00", "Simulado cronometrado", { nomeProva: "Simulado no haras", local: "Paraisópolis", tempoSegundos: 17.330 }],
  ["trovao", "treinador", "competicao", "prova classificatoria", "2026-10-10T16:00:00-03:00", "Classificatória", { nomeProva: "Circuito Mineiro", local: "Itajubá", categoria: "Amador", tempoSegundos: 16.811, colocacao: 4, penalidade: 0 }],
];

const RELACAO = { saude: "saude", manejo: "manejo", treinamento: "treinamento", competicao: "competicao" };

function data(texto) {
  return new Date(`${texto}T00:00:00.000Z`);
}

async function main() {
  if (!process.argv.includes("--confirmar")) {
    console.error("Este script APAGA os dados de uso da base local. Rode com --confirmar.");
    process.exitCode = 1;
    return;
  }
  exigirBancoLocal();
  const prisma = new PrismaClient();
  try {
    const papeis = Object.fromEntries((await prisma.papel.findMany()).map((p) => [p.nome, p.id]));
    if (Object.keys(papeis).length !== 4) {
      throw new Error("Carga inicial ausente: aplique as migracoes e rode o seed (npx prisma db seed).");
    }
    const tipos = await prisma.tipoEvento.findMany();
    const tipoId = (dominio, nome) => tipos.find((t) => t.dominio === dominio && t.nome === nome).id;
    const senhaHash = await bcrypt.hash(SENHA, 12);

    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`
        TRUNCATE log_auditoria, anexo, lembrete, evento_historico, evento_saude,
                 evento_manejo, evento_treinamento, evento_competicao, evento,
                 vinculo_acesso, animal, usuario
        RESTART IDENTITY CASCADE`);

      const usuarios = {};
      for (const u of USUARIOS) {
        usuarios[u.chave] = await tx.usuario.create({
          data: { nome: u.nome, email: u.email, telefone: u.telefone, senhaHash },
        });
      }

      const animais = {};
      for (const a of ANIMAIS) {
        animais[a.chave] = await tx.animal.create({
          data: {
            nome: a.nome,
            registroAssociacao: a.registroAssociacao,
            dataNascimento: data(a.dataNascimento),
            sexo: a.sexo,
            pelagem: a.pelagem,
            proprietarioId: usuarios.proprietario.id,
          },
        });
        for (const papel of ["proprietario", "veterinario", "treinador", "manejo"]) {
          await tx.vinculoAcesso.create({
            data: {
              usuarioId: usuarios[papel].id,
              animalId: animais[a.chave].id,
              papelId: papeis[papel],
              dataInicio: data("2026-01-01"),
              dataFim: null,
              concedidoPor: usuarios.proprietario.id,
            },
          });
        }
      }

      for (const [animal, autor, dominio, tipo, dataEvento, titulo, detalhe] of EVENTOS) {
        const id = randomUUID();
        const dadosSubtipo = { ...detalhe };
        if (dadosSubtipo.dataRetorno) dadosSubtipo.dataRetorno = data(dadosSubtipo.dataRetorno);
        await tx.evento.create({
          data: {
            id,
            animalId: animais[animal].id,
            tipoEventoId: tipoId(dominio, tipo),
            dataEvento: new Date(dataEvento),
            titulo,
            registradoPor: usuarios[autor].id,
            [RELACAO[dominio]]: { create: dadosSubtipo },
          },
        });
        // lembrete nasce da data de retorno informada no registro (RF17)
        if (detalhe.dataRetorno) {
          await tx.lembrete.create({
            data: {
              eventoId: id,
              animalId: animais[animal].id,
              dataPrevista: data(detalhe.dataRetorno),
              status: "pendente",
              criadoPor: usuarios[autor].id,
            },
          });
        }
      }
    });

    const [usuarios, animais, eventos, lembretes, porDominio] = await Promise.all([
      prisma.usuario.count(),
      prisma.animal.count(),
      prisma.evento.count(),
      prisma.lembrete.count(),
      prisma.$queryRaw`SELECT t.dominio, count(*)::int AS total FROM evento e JOIN tipo_evento t ON t.id = e.tipo_evento_id GROUP BY t.dominio ORDER BY t.dominio`,
    ]);
    console.log(`Base reinicializada: ${usuarios} usuarios, ${animais} animais, ${eventos} eventos, ${lembretes} lembretes.`);
    console.log(`Eventos por dominio: ${porDominio.map((l) => `${l.dominio} ${l.total}`).join(", ")}.`);
    console.log("Credenciais (senha comum: SENHA_SESSAO ou a padrao do script):");
    for (const u of USUARIOS) console.log(`  ${u.chave.padEnd(13)} ${u.email}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((erro) => {
  console.error(erro.message);
  process.exitCode = 1;
});
