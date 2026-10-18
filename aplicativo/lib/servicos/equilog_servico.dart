// Operacoes de dominio consumidas pelas telas (especificacao, secao 5).
// O registro de eventos nao passa por aqui: vai para a fila local e e enviado
// pela sincronizacao em lote (RF21).

import '../modelos/entidades.dart';
import 'api_cliente.dart';

class FiltrosLinhaDoTempo {
  final String? dominio;
  final String? de; // AAAA-MM-DD
  final String? ate; // AAAA-MM-DD
  final String? autorId;

  const FiltrosLinhaDoTempo({this.dominio, this.de, this.ate, this.autorId});

  Map<String, String> paraConsulta() => {
        'dominio': ?dominio,
        'de': ?de,
        'ate': ?ate,
        'autorId': ?autorId,
      };
}

class EquilogServico {
  final ApiCliente api;
  const EquilogServico(this.api);

  Future<List<Animal>> listarAnimais() async {
    final corpo = await api.get('/animais') as Map<String, dynamic>;
    return (corpo['itens'] as List).map((j) => Animal.deJson(j as Map<String, dynamic>)).toList();
  }

  Future<Animal> cadastrarAnimal(Map<String, dynamic> dados) async =>
      Animal.deJson(await api.post('/animais', dados) as Map<String, dynamic>);

  // RF05: edicao e inativacao (ativo = false) pelo proprietario
  Future<Animal> editarAnimal(String animalId, Map<String, dynamic> alteracoes) async =>
      Animal.deJson(await api.patch('/animais/$animalId', alteracoes) as Map<String, dynamic>);

  // RF15: edicao pelo autor; versao informada detecta alteracao concorrente (409)
  Future<ItemLinhaDoTempo> editarEvento(String eventoId, Map<String, dynamic> alteracoes) async =>
      ItemLinhaDoTempo.deJson(await api.patch('/eventos/$eventoId', alteracoes) as Map<String, dynamic>);

  // RF16: exclusao logica pelo autor ou pelo proprietario
  Future<void> excluirEvento(String eventoId) => api.delete('/eventos/$eventoId');

  Future<List<dynamic>> listarTiposEvento() async =>
      (await api.get('/tipos-evento') as Map<String, dynamic>)['itens'] as List<dynamic>;

  Future<PaginaLinhaDoTempo> linhaDoTempo(
    String animalId, {
    FiltrosLinhaDoTempo filtros = const FiltrosLinhaDoTempo(),
    int limite = 20,
    int deslocamento = 0,
  }) async {
    final corpo = await api.get('/animais/$animalId/eventos', consulta: {
      ...filtros.paraConsulta(),
      'limite': '$limite',
      'deslocamento': '$deslocamento',
    }) as Map<String, dynamic>;
    final itens = (corpo['itens'] as List).map((j) => ItemLinhaDoTempo.deJson(j as Map<String, dynamic>)).toList();
    return PaginaLinhaDoTempo(itens, corpo['total'] as int);
  }

  Future<List<Lembrete>> listarLembretes({String? status}) async {
    final corpo = await api.get('/lembretes', consulta: status == null ? null : {'status': status}) as Map<String, dynamic>;
    return (corpo['itens'] as List).map((j) => Lembrete.deJson(j as Map<String, dynamic>)).toList();
  }

  Future<Lembrete> alterarLembrete(String id, String status, {String? novaData}) async => Lembrete.deJson(
        await api.patch('/lembretes/$id', {'status': status, 'dataPrevista': ?novaData})
            as Map<String, dynamic>,
      );

  Future<List<Vinculo>> listarAcessos(String animalId) async {
    final corpo = await api.get('/animais/$animalId/acessos') as Map<String, dynamic>;
    return (corpo['itens'] as List).map((j) => Vinculo.deJson(j as Map<String, dynamic>)).toList();
  }

  Future<Vinculo> concederAcesso(String animalId, {required String email, required String papel, String? dataInicio, String? dataFim}) async =>
      Vinculo.deJson(await api.post('/animais/$animalId/acessos', {
        'email': email,
        'papel': papel,
        'dataInicio': ?dataInicio,
        'dataFim': ?dataFim,
      }) as Map<String, dynamic>);

  Future<void> revogarAcesso(String vinculoId) => api.delete('/acessos/$vinculoId');
}
