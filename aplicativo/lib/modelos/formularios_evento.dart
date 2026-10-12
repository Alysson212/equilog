// Definicao dos formularios de registro, gerados a partir do dominio (Etapa 5.3).
//
// RNF07: nenhum evento de rotina exige mais de cinco campos obrigatorios.
// Os obrigatorios de todo registro sao tipo, data e titulo; cada dominio soma o
// seu atributo principal. Nos tipos de saude com exige_retorno, a data de
// retorno tambem e obrigatoria no formulario (cinco no total). O sistema nao
// propoe nem calcula essa data: a pessoa a digita (RNF11).
//
// Tipos de evento: espelho da carga inicial de tipo_evento (especificacao,
// secao 3). Nao ha endpoint de tipos; a lista e fixa na especificacao.

enum TipoCampo { texto, textoLongo, inteiro, decimal, data }

class CampoFormulario {
  final String nome;
  final String rotulo;
  final TipoCampo tipo;
  final bool obrigatorio;
  final int? maximo;

  const CampoFormulario(this.nome, this.rotulo, this.tipo, {this.obrigatorio = false, this.maximo});
}

class TipoEvento {
  final String nome;
  final bool exigeRetorno;
  const TipoEvento(this.nome, {this.exigeRetorno = false});
}

const Map<String, List<TipoEvento>> tiposPorDominio = {
  'saude': [
    TipoEvento('vacinacao', exigeRetorno: true),
    TipoEvento('vermifugacao', exigeRetorno: true),
    TipoEvento('procedimento odontologico', exigeRetorno: true),
    TipoEvento('consulta clinica'),
    TipoEvento('exame'),
    TipoEvento('tratamento'),
    TipoEvento('lesao'),
    TipoEvento('aplicacao de medicamento'),
    TipoEvento('coleta de material'),
  ],
  'manejo': [
    TipoEvento('alimentacao'),
    TipoEvento('suplementacao'),
    TipoEvento('casqueamento'),
    TipoEvento('ferrageamento'),
    TipoEvento('banho e higiene'),
    TipoEvento('limpeza de baia'),
    TipoEvento('troca de baia'),
    TipoEvento('transporte'),
  ],
  'treinamento': [
    TipoEvento('trabalho de tambor'),
    TipoEvento('trabalho de pista'),
    TipoEvento('condicionamento'),
    TipoEvento('trabalho na esteira'),
    TipoEvento('soltura em piquete'),
    TipoEvento('descanso'),
  ],
  'competicao': [
    TipoEvento('prova oficial'),
    TipoEvento('prova classificatoria'),
    TipoEvento('prova final'),
    TipoEvento('simulado de treino'),
  ],
};

// Nome exibido para o tipo (a carga do banco nao tem acentos)
const nomesTipo = {
  'vacinacao': 'Vacinação',
  'vermifugacao': 'Vermifugação',
  'procedimento odontologico': 'Procedimento odontológico',
  'consulta clinica': 'Consulta clínica',
  'exame': 'Exame',
  'tratamento': 'Tratamento',
  'lesao': 'Lesão',
  'aplicacao de medicamento': 'Aplicação de medicamento',
  'coleta de material': 'Coleta de material',
  'alimentacao': 'Alimentação',
  'suplementacao': 'Suplementação',
  'casqueamento': 'Casqueamento',
  'ferrageamento': 'Ferrageamento',
  'banho e higiene': 'Banho e higiene',
  'limpeza de baia': 'Limpeza de baia',
  'troca de baia': 'Troca de baia',
  'transporte': 'Transporte',
  'trabalho de tambor': 'Trabalho de tambor',
  'trabalho de pista': 'Trabalho de pista',
  'condicionamento': 'Condicionamento',
  'trabalho na esteira': 'Trabalho na esteira',
  'soltura em piquete': 'Soltura em piquete',
  'descanso': 'Descanso',
  'prova oficial': 'Prova oficial',
  'prova classificatoria': 'Prova classificatória',
  'prova final': 'Prova final',
  'simulado de treino': 'Simulado de treino',
};

// Campos especificos de cada dominio (tabelas de subtipo). O primeiro de cada
// lista e o atributo principal, obrigatorio; os demais ficam na secao recolhida.
const Map<String, List<CampoFormulario>> camposPorDominio = {
  'saude': [
    CampoFormulario('procedimento', 'Procedimento', TipoCampo.texto, obrigatorio: true, maximo: 80),
    CampoFormulario('produto', 'Produto', TipoCampo.texto, maximo: 120),
    CampoFormulario('dose', 'Dose', TipoCampo.texto, maximo: 40),
    CampoFormulario('via', 'Via de aplicação', TipoCampo.texto, maximo: 40),
    CampoFormulario('profissional', 'Profissional', TipoCampo.texto, maximo: 120),
  ],
  'manejo': [
    CampoFormulario('categoria', 'Categoria', TipoCampo.texto, obrigatorio: true, maximo: 60),
    CampoFormulario('descricao', 'Descrição', TipoCampo.texto, maximo: 200),
    CampoFormulario('quantidade', 'Quantidade', TipoCampo.decimal),
    CampoFormulario('unidade', 'Unidade', TipoCampo.texto, maximo: 12),
  ],
  'treinamento': [
    CampoFormulario('tipoExercicio', 'Tipo de exercício', TipoCampo.texto, obrigatorio: true, maximo: 60),
    CampoFormulario('duracaoMin', 'Duração (minutos)', TipoCampo.inteiro),
    CampoFormulario('intensidade', 'Intensidade', TipoCampo.texto, maximo: 20),
    CampoFormulario('piso', 'Piso', TipoCampo.texto, maximo: 40),
  ],
  'competicao': [
    CampoFormulario('nomeProva', 'Nome da prova', TipoCampo.texto, obrigatorio: true, maximo: 140),
    CampoFormulario('local', 'Local', TipoCampo.texto, maximo: 140),
    CampoFormulario('categoria', 'Categoria', TipoCampo.texto, maximo: 60),
    CampoFormulario('tempoSegundos', 'Tempo (segundos)', TipoCampo.decimal),
    CampoFormulario('colocacao', 'Colocação', TipoCampo.inteiro),
    CampoFormulario('penalidade', 'Penalidade (segundos)', TipoCampo.decimal),
  ],
};

// Campo de data de retorno, exclusivo de saude
const campoDataRetorno = CampoFormulario('dataRetorno', 'Data de retorno', TipoCampo.data);

// Comuns a todo registro: tipo, data e titulo (obrigatorios) e observacao
const camposComunsObrigatorios = ['tipoEvento', 'dataEvento', 'titulo'];

// Quantos campos o usuario e obrigado a preencher para o tipo escolhido (RNF07)
int contarObrigatorios(String dominio, TipoEvento tipo) {
  final especificos = camposPorDominio[dominio]!.where((c) => c.obrigatorio).length;
  final retorno = dominio == 'saude' && tipo.exigeRetorno ? 1 : 0;
  return camposComunsObrigatorios.length + especificos + retorno;
}
