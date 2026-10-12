// Copia da matriz de permissoes (especificacao, secao 4) usada APENAS para
// esconder da interface o que o papel nao pode fazer. E conveniencia visual:
// a decisao de acesso e sempre do servidor (RNF03), que recusa com 403
// qualquer operacao fora do papel, venha ou nao deste aplicativo.

enum Acao { criar, ler, editar }

const _c = Acao.criar;
const _l = Acao.ler;
const _e = Acao.editar;

const Map<String, Map<String, List<Acao>>> _matriz = {
  'saude': {'proprietario': [_l], 'veterinario': [_c, _l, _e], 'treinador': [_l], 'manejo': []},
  'manejo': {'proprietario': [_c, _l, _e], 'veterinario': [_l], 'treinador': [_l], 'manejo': [_c, _l, _e]},
  'treinamento': {'proprietario': [_c, _l, _e], 'veterinario': [_l], 'treinador': [_c, _l, _e], 'manejo': [_l]},
  'competicao': {'proprietario': [_c, _l, _e], 'veterinario': [], 'treinador': [_c, _l, _e], 'manejo': []},
  'animal': {'proprietario': [_c, _l, _e], 'veterinario': [_l], 'treinador': [_l], 'manejo': [_l]},
  'acesso': {'proprietario': [_c, _l, _e], 'veterinario': [], 'treinador': [], 'manejo': []},
  'anexo': {'proprietario': [_c, _l], 'veterinario': [_c, _l], 'treinador': [_c, _l], 'manejo': [_l]},
  'lembrete': {'proprietario': [_l, _e], 'veterinario': [_c, _l, _e], 'treinador': [_l, _e], 'manejo': [_l]},
  'exportacao': {'proprietario': [_c, _l], 'veterinario': [_l], 'treinador': [_l], 'manejo': []},
  'auditoria': {'proprietario': [_l], 'veterinario': [], 'treinador': [], 'manejo': []},
};

const dominiosEvento = ['saude', 'manejo', 'treinamento', 'competicao'];

bool papelPode(String papel, Acao acao, String operacao) =>
    _matriz[operacao]?[papel]?.contains(acao) ?? false;

List<String> dominiosLegiveis(String papel) =>
    dominiosEvento.where((d) => papelPode(papel, Acao.ler, d)).toList();

List<String> dominiosRegistraveis(String papel) =>
    dominiosEvento.where((d) => papelPode(papel, Acao.criar, d)).toList();

const nomesDominio = {
  'saude': 'Saúde',
  'manejo': 'Manejo',
  'treinamento': 'Treinamento',
  'competicao': 'Competição',
};

const nomesPapel = {
  'proprietario': 'Proprietário',
  'veterinario': 'Veterinário',
  'treinador': 'Treinador',
  'manejo': 'Responsável pelo manejo',
};
