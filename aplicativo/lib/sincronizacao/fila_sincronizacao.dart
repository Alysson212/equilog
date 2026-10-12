// Fila de sincronizacao sob conectividade intermitente (RF21, RNF06; Figura 7
// e Trecho de codigo 5 do TCC).
//
// Todo evento e gravado primeiro na base local, com UUID gerado no aparelho e
// estado pendente, e so depois enviado. O envio usa POST /sincronizacao/lote
// (decisao 9.3), em ordem cronologica, e o resultado de cada item decide o
// estado local: sincronizado, conflito (mantido na fila e sinalizado ao
// usuario) ou recusado (por exemplo, vinculo revogado apos a gravacao local).
// Sem conexao, o lote e interrompido e nova tentativa ocorre quando a conexao
// e restabelecida. O reenvio e idempotente: o servidor reconhece o id.

import 'dart:async';

import 'package:uuid/uuid.dart';

import '../servicos/api_cliente.dart';
import 'base_local.dart';

class ResultadoSincronizacao {
  final int enviados;
  final int sincronizados;
  final int conflitos;
  final int recusados;
  final bool interrompidoSemConexao;

  const ResultadoSincronizacao({
    this.enviados = 0,
    this.sincronizados = 0,
    this.conflitos = 0,
    this.recusados = 0,
    this.interrompidoSemConexao = false,
  });
}

class FilaSincronizacao {
  static const tamanhoLote = 50;
  static const _uuid = Uuid();

  final BaseLocal base;
  final ApiCliente api;
  final _alteracoes = StreamController<void>.broadcast();
  final _conflitos = StreamController<EventoLocal>.broadcast();
  Future<ResultadoSincronizacao>? _emAndamento;
  StreamSubscription<bool>? _conectividade;

  FilaSincronizacao({required this.base, required this.api});

  // Avisa as telas que o estado local mudou
  Stream<void> get alteracoes => _alteracoes.stream;

  // Conflitos detectados, para sinalizacao ao usuario
  Stream<EventoLocal> get conflitos => _conflitos.stream;

  // Grava o evento localmente em estado pendente. O id e gerado aqui, no
  // aparelho, antes de qualquer envio.
  Future<EventoLocal> registrar({
    required String usuarioId,
    required String animalId,
    required Map<String, dynamic> corpo,
  }) async {
    final id = (corpo['id'] as String?) ?? _uuid.v4();
    final evento = EventoLocal(
      id: id,
      usuarioId: usuarioId,
      animalId: animalId,
      dominio: corpo['dominio'] as String,
      dataEvento: DateTime.parse(corpo['dataEvento'] as String),
      corpo: {...corpo, 'id': id},
    );
    await base.inserir(evento);
    _alteracoes.add(null);
    return evento;
  }

  // Processa a fila; chamadas simultaneas compartilham a mesma execucao
  Future<ResultadoSincronizacao> processarFila(String usuarioId) {
    return _emAndamento ??= _processar(usuarioId).whenComplete(() => _emAndamento = null);
  }

  Future<ResultadoSincronizacao> _processar(String usuarioId) async {
    // envio em ordem cronologica, para preservar a coerencia da linha do tempo
    final pendentes = await base.eventosPorEstado(usuarioId, EstadoSync.pendente);
    if (pendentes.isEmpty) return const ResultadoSincronizacao();

    var enviados = 0, sincronizados = 0, conflitos = 0, recusados = 0;
    for (var inicio = 0; inicio < pendentes.length; inicio += tamanhoLote) {
      final lote = pendentes.sublist(inicio, (inicio + tamanhoLote).clamp(0, pendentes.length));
      final List<dynamic> resultados;
      try {
        final resposta = await api.post('/sincronizacao/lote', lote.map((e) => e.paraItemDeLote()).toList());
        resultados = (resposta as Map<String, dynamic>)['resultados'] as List<dynamic>;
      } on SemConexaoException {
        // interrompe o lote; nova tentativa ao restabelecer a conexao
        _alteracoes.add(null);
        return ResultadoSincronizacao(
          enviados: enviados,
          sincronizados: sincronizados,
          conflitos: conflitos,
          recusados: recusados,
          interrompidoSemConexao: true,
        );
      }
      enviados += lote.length;

      for (final bruto in resultados) {
        final resultado = bruto as Map<String, dynamic>;
        final id = resultado['id'] as String?;
        final evento = lote.where((e) => e.id == id).firstOrNull;
        if (evento == null) continue;
        final versaoServidor = resultado['versaoServidor'] as int?;
        switch (resultado['situacao']) {
          case 'sincronizado':
            await base.marcar(evento.id, EstadoSync.sincronizado, versaoServidor: versaoServidor);
            sincronizados++;
          case 'conflito':
            // o registro permanece na fila e e sinalizado ao usuario
            await base.marcar(evento.id, EstadoSync.conflito, versaoServidor: versaoServidor);
            _conflitos.add(evento);
            conflitos++;
          case 'recusado':
            // vinculo revogado ou papel sem permissao apos a gravacao local
            await base.marcar(evento.id, EstadoSync.recusado, motivo: resultado['motivo'] as String?);
            recusados++;
        }
      }
    }
    _alteracoes.add(null);
    return ResultadoSincronizacao(
      enviados: enviados,
      sincronizados: sincronizados,
      conflitos: conflitos,
      recusados: recusados,
    );
  }

  // Nova tentativa a cada restabelecimento de conexao
  void escutarConectividade(Stream<bool> conectado, String Function() usuarioAtual) {
    _conectividade?.cancel();
    _conectividade = conectado.where((online) => online).listen((_) async {
      try {
        await processarFila(usuarioAtual());
      } on SessaoExpiradaException {
        // sem sessao, os registros continuam pendentes ate o proximo login
      } on ErroApi {
        // falha do servidor: os registros continuam pendentes
      }
    });
  }

  Future<void> encerrar() async {
    await _conectividade?.cancel();
    await _alteracoes.close();
    await _conflitos.close();
  }
}
