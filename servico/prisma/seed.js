// Carga inicial: papel, permissao, papel_permissao e tipo_evento.
// Permissoes derivadas da matriz em src/dominio/matrizPermissoes.js
// (especificacao, secao 4). Idempotente: pode ser executado mais de uma vez.

const { PrismaClient } = require("@prisma/client");
const {
  listarPermissoes,
  listarConcessoes,
} = require("../src/dominio/matrizPermissoes");

const prisma = new PrismaClient();

const PAPEIS = [
  { nome: "proprietario", descricao: "Proprietário ou competidor, cadastra o animal e administra os acessos" },
  { nome: "veterinario", descricao: "Médico veterinário, registra eventos de saúde" },
  { nome: "treinador", descricao: "Treinador, registra treinamentos e provas" },
  { nome: "manejo", descricao: "Responsável pelo manejo, registra a rotina de trato e cuidados" },
];

// Especificacao, secao 3, carga inicial de tipo_evento.
// exige_retorno apenas torna a data obrigatoria no formulario; nada e calculado.
const TIPOS_EVENTO = [
  ["saude", ["vacinacao", "vermifugacao", "procedimento odontologico"], true],
  ["saude", ["consulta clinica", "exame", "tratamento", "lesao", "aplicacao de medicamento", "coleta de material"], false],
  ["manejo", ["alimentacao", "suplementacao", "casqueamento", "ferrageamento", "banho e higiene", "limpeza de baia", "troca de baia", "transporte"], false],
  ["treinamento", ["trabalho de tambor", "trabalho de pista", "condicionamento", "trabalho na esteira", "soltura em piquete", "descanso"], false],
  ["competicao", ["prova oficial", "prova classificatoria", "prova final", "simulado de treino"], false],
];

async function semearPapeis(tx) {
  for (const papel of PAPEIS) {
    await tx.papel.upsert({
      where: { nome: papel.nome },
      update: { descricao: papel.descricao },
      create: papel,
    });
  }
}

async function semearPermissoes(tx) {
  for (const permissao of listarPermissoes()) {
    await tx.permissao.upsert({
      where: { codigo: permissao.codigo },
      update: { descricao: permissao.descricao },
      create: permissao,
    });
  }
}

async function semearPapelPermissao(tx) {
  const papeis = await tx.papel.findMany();
  const permissoes = await tx.permissao.findMany();
  const idPapel = Object.fromEntries(papeis.map((p) => [p.nome, p.id]));
  const idPermissao = Object.fromEntries(permissoes.map((p) => [p.codigo, p.id]));

  const linhas = listarConcessoes().map(({ papel, codigo }) => ({
    papelId: idPapel[papel],
    permissaoId: idPermissao[codigo],
  }));

  // a matriz e a fonte: a tabela e reconstruida para refleti-la exatamente
  await tx.papelPermissao.deleteMany();
  await tx.papelPermissao.createMany({ data: linhas });
}

async function semearTiposEvento(tx) {
  for (const [dominio, nomes, exigeRetorno] of TIPOS_EVENTO) {
    for (const nome of nomes) {
      const existente = await tx.tipoEvento.findFirst({ where: { dominio, nome } });
      if (existente) {
        await tx.tipoEvento.update({ where: { id: existente.id }, data: { exigeRetorno } });
      } else {
        await tx.tipoEvento.create({ data: { dominio, nome, exigeRetorno } });
      }
    }
  }
}

async function main() {
  await prisma.$transaction(async (tx) => {
    await semearPapeis(tx);
    await semearPermissoes(tx);
    await semearPapelPermissao(tx);
    await semearTiposEvento(tx);
  });

  const [papeis, permissoes, concessoes, tipos] = await Promise.all([
    prisma.papel.count(),
    prisma.permissao.count(),
    prisma.papelPermissao.count(),
    prisma.tipoEvento.count(),
  ]);
  console.log(`papel: ${papeis} | permissao: ${permissoes} | papel_permissao: ${concessoes} | tipo_evento: ${tipos}`);
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
