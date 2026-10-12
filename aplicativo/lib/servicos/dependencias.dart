// Objetos compartilhados pelas telas: cliente da API, servico de dominio, base
// local, fila de sincronizacao, notificacoes e usuario da sessao.

import 'package:flutter/widgets.dart';

import '../modelos/entidades.dart';
import '../sincronizacao/base_local.dart';
import '../sincronizacao/fila_sincronizacao.dart';
import 'api_cliente.dart';
import 'equilog_servico.dart';
import 'notificacoes_servico.dart';

class Dependencias {
  final ApiCliente api;
  final EquilogServico servico;
  final BaseLocal base;
  final FilaSincronizacao fila;
  final NotificacoesServico notificacoes;
  Usuario? usuario;

  Dependencias({
    required this.api,
    required this.servico,
    required this.base,
    required this.fila,
    required this.notificacoes,
    this.usuario,
  });

  static Dependencias de(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<_Provedor>()!.dependencias;

  // Lista de animais com fallback para a ultima lista conhecida, sem conexao
  Future<(List<Animal>, bool)> animais() async {
    final chave = 'animais:${usuario!.id}';
    List<dynamic> itens;
    var doCache = false;
    try {
      itens = (await api.get('/animais') as Map<String, dynamic>)['itens'] as List<dynamic>;
      await base.guardarCache(chave, itens);
    } on SemConexaoException {
      final cache = await base.lerCache(chave) as List<dynamic>?;
      if (cache == null) rethrow;
      itens = cache;
      doCache = true;
    }
    return (itens.map((j) => Animal.deJson(j as Map<String, dynamic>)).toList(), doCache);
  }

  // Sincroniza a fila e o agendamento de notificacoes, sem interromper a tela
  Future<ResultadoSincronizacao?> sincronizar() async {
    final atual = usuario;
    if (atual == null) return null;
    try {
      final resultado = await fila.processarFila(atual.id);
      if (!resultado.interrompidoSemConexao) {
        await notificacoes.sincronizarAgendamentos(await servico.listarLembretes());
      }
      return resultado;
    } on SemConexaoException {
      return null;
    } on SessaoExpiradaException {
      return null;
    }
  }
}

class ProvedorDependencias extends StatelessWidget {
  final Dependencias dependencias;
  final Widget child;

  const ProvedorDependencias({super.key, required this.dependencias, required this.child});

  @override
  Widget build(BuildContext context) => _Provedor(dependencias: dependencias, child: child);
}

class _Provedor extends InheritedWidget {
  final Dependencias dependencias;
  const _Provedor({required this.dependencias, required super.child});

  @override
  bool updateShouldNotify(_Provedor antigo) => antigo.dependencias != dependencias;
}
