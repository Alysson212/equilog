-- Valores admitidos para o sexo do animal (especificacao, secao 3):
-- M macho inteiro, F femea, C macho castrado.
-- Provas e categorias de tres tambores separam por sexo.
ALTER TABLE "animal" ADD CONSTRAINT "animal_sexo_check"
    CHECK ("sexo" IN ('M', 'F', 'C'));
