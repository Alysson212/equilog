-- CreateTable
CREATE TABLE "usuario" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nome" VARCHAR(120) NOT NULL,
    "email" VARCHAR(160) NOT NULL,
    "senha_hash" VARCHAR(255) NOT NULL,
    "telefone" VARCHAR(20),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "papel" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(40) NOT NULL,
    "descricao" VARCHAR(160),

    CONSTRAINT "papel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissao" (
    "id" SERIAL NOT NULL,
    "codigo" VARCHAR(60) NOT NULL,
    "descricao" VARCHAR(160),

    CONSTRAINT "permissao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "papel_permissao" (
    "papel_id" INTEGER NOT NULL,
    "permissao_id" INTEGER NOT NULL,

    CONSTRAINT "papel_permissao_pkey" PRIMARY KEY ("papel_id","permissao_id")
);

-- CreateTable
CREATE TABLE "animal" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nome" VARCHAR(120) NOT NULL,
    "registro_associacao" VARCHAR(40),
    "data_nascimento" DATE,
    "sexo" CHAR(1) NOT NULL,
    "pelagem" VARCHAR(60),
    "proprietario_id" UUID NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "animal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vinculo_acesso" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" UUID NOT NULL,
    "animal_id" UUID NOT NULL,
    "papel_id" INTEGER NOT NULL,
    "data_inicio" DATE NOT NULL,
    "data_fim" DATE,
    "concedido_por" UUID NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "vinculo_acesso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipo_evento" (
    "id" SERIAL NOT NULL,
    "dominio" VARCHAR(12) NOT NULL,
    "nome" VARCHAR(60) NOT NULL,
    "exige_retorno" BOOLEAN NOT NULL,

    CONSTRAINT "tipo_evento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evento" (
    "id" UUID NOT NULL,
    "animal_id" UUID NOT NULL,
    "tipo_evento_id" INTEGER NOT NULL,
    "data_evento" TIMESTAMPTZ NOT NULL,
    "titulo" VARCHAR(140) NOT NULL,
    "observacao" TEXT,
    "registrado_por" UUID NOT NULL,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "excluido_em" TIMESTAMPTZ,
    "criado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evento_saude" (
    "evento_id" UUID NOT NULL,
    "procedimento" VARCHAR(80) NOT NULL,
    "produto" VARCHAR(120),
    "dose" VARCHAR(40),
    "via" VARCHAR(40),
    "profissional" VARCHAR(120),
    "data_retorno" DATE,

    CONSTRAINT "evento_saude_pkey" PRIMARY KEY ("evento_id")
);

-- CreateTable
CREATE TABLE "evento_manejo" (
    "evento_id" UUID NOT NULL,
    "categoria" VARCHAR(60) NOT NULL,
    "descricao" VARCHAR(200),
    "quantidade" DECIMAL(8,2),
    "unidade" VARCHAR(12),

    CONSTRAINT "evento_manejo_pkey" PRIMARY KEY ("evento_id")
);

-- CreateTable
CREATE TABLE "evento_treinamento" (
    "evento_id" UUID NOT NULL,
    "tipo_exercicio" VARCHAR(60) NOT NULL,
    "duracao_min" INTEGER,
    "intensidade" VARCHAR(20),
    "piso" VARCHAR(40),

    CONSTRAINT "evento_treinamento_pkey" PRIMARY KEY ("evento_id")
);

-- CreateTable
CREATE TABLE "evento_competicao" (
    "evento_id" UUID NOT NULL,
    "nome_prova" VARCHAR(140) NOT NULL,
    "local" VARCHAR(140),
    "categoria" VARCHAR(60),
    "tempo_segundos" DECIMAL(6,3),
    "colocacao" INTEGER,
    "penalidade" DECIMAL(6,3),

    CONSTRAINT "evento_competicao_pkey" PRIMARY KEY ("evento_id")
);

-- CreateTable
CREATE TABLE "evento_historico" (
    "id" BIGSERIAL NOT NULL,
    "evento_id" UUID NOT NULL,
    "versao_anterior" INTEGER NOT NULL,
    "conteudo_anterior" JSONB NOT NULL,
    "alterado_por" UUID NOT NULL,
    "alterado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evento_historico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anexo" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "evento_id" UUID NOT NULL,
    "nome_arquivo" VARCHAR(200) NOT NULL,
    "caminho" VARCHAR(300) NOT NULL,
    "mime_type" VARCHAR(80),
    "tamanho_bytes" INTEGER,
    "enviado_por" UUID NOT NULL,

    CONSTRAINT "anexo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lembrete" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "evento_id" UUID NOT NULL,
    "animal_id" UUID NOT NULL,
    "data_prevista" DATE NOT NULL,
    "status" VARCHAR(12) NOT NULL DEFAULT 'pendente',
    "criado_por" UUID NOT NULL,

    CONSTRAINT "lembrete_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "log_auditoria" (
    "id" BIGSERIAL NOT NULL,
    "usuario_id" UUID,
    "identificador_tentativa" VARCHAR(160),
    "acao" VARCHAR(40) NOT NULL,
    "entidade" VARCHAR(40),
    "entidade_id" VARCHAR(60),
    "motivo" VARCHAR(60),
    "data_hora" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endereco_ip" VARCHAR(45),

    CONSTRAINT "log_auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "papel_nome_key" ON "papel"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "permissao_codigo_key" ON "permissao"("codigo");

-- AddForeignKey
ALTER TABLE "papel_permissao" ADD CONSTRAINT "papel_permissao_papel_id_fkey" FOREIGN KEY ("papel_id") REFERENCES "papel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "papel_permissao" ADD CONSTRAINT "papel_permissao_permissao_id_fkey" FOREIGN KEY ("permissao_id") REFERENCES "permissao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animal" ADD CONSTRAINT "animal_proprietario_id_fkey" FOREIGN KEY ("proprietario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vinculo_acesso" ADD CONSTRAINT "vinculo_acesso_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vinculo_acesso" ADD CONSTRAINT "vinculo_acesso_animal_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vinculo_acesso" ADD CONSTRAINT "vinculo_acesso_papel_id_fkey" FOREIGN KEY ("papel_id") REFERENCES "papel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vinculo_acesso" ADD CONSTRAINT "vinculo_acesso_concedido_por_fkey" FOREIGN KEY ("concedido_por") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evento" ADD CONSTRAINT "evento_animal_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evento" ADD CONSTRAINT "evento_tipo_evento_id_fkey" FOREIGN KEY ("tipo_evento_id") REFERENCES "tipo_evento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evento" ADD CONSTRAINT "evento_registrado_por_fkey" FOREIGN KEY ("registrado_por") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evento_saude" ADD CONSTRAINT "evento_saude_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "evento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evento_manejo" ADD CONSTRAINT "evento_manejo_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "evento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evento_treinamento" ADD CONSTRAINT "evento_treinamento_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "evento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evento_competicao" ADD CONSTRAINT "evento_competicao_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "evento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evento_historico" ADD CONSTRAINT "evento_historico_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "evento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evento_historico" ADD CONSTRAINT "evento_historico_alterado_por_fkey" FOREIGN KEY ("alterado_por") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anexo" ADD CONSTRAINT "anexo_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "evento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anexo" ADD CONSTRAINT "anexo_enviado_por_fkey" FOREIGN KEY ("enviado_por") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lembrete" ADD CONSTRAINT "lembrete_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "evento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lembrete" ADD CONSTRAINT "lembrete_animal_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lembrete" ADD CONSTRAINT "lembrete_criado_por_fkey" FOREIGN KEY ("criado_por") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "log_auditoria" ADD CONSTRAINT "log_auditoria_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Acrescimos manuais: recursos sem representacao no schema.prisma

-- indice que sustenta a consulta mais frequente do sistema:
-- a linha do tempo do animal em ordem cronologica decrescente (RF13)
CREATE INDEX idx_evento_animal_data
    ON evento (animal_id, data_evento DESC)
    WHERE excluido_em IS NULL;

-- valores admitidos (especificacao, secao 3)
ALTER TABLE "tipo_evento" ADD CONSTRAINT "tipo_evento_dominio_check"
    CHECK ("dominio" IN ('saude', 'manejo', 'treinamento', 'competicao'));

ALTER TABLE "lembrete" ADD CONSTRAINT "lembrete_status_check"
    CHECK ("status" IN ('pendente', 'cumprido', 'adiado', 'cancelado'));
