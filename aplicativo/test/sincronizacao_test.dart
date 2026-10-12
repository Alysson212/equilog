// CT09, CT10 e CT11 (RF21, RNF06) contra o SERVIDOR REAL, com a base local
// SQLite real (via FFI, fora do aparelho). Tambem: conflito de versao mantido
// na fila (409 da decisao 9.3) e recusa apos revogacao do vinculo (403).

import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:equilog/sincronizacao/base_local.dart';
import 'package:equilog/sincronizacao/fila_sincronizacao.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:path/path.dart' as p;
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

import 'apoio_servidor.dart';

Map<String, dynamic> corpoManejo(String titulo, String dataEvento) => {
      'dominio': 'manejo',
      'tipoEvento': 'alimentacao',
      'dataEvento': dataEvento,
      'titulo': titulo,
      'detalhe': {'categoria': 'racao', 'quantidade': 4.5, 'unidade': 'kg'},
    };

void main() {
  sqfliteFfiInit();
  final servidor = ServidorReal();
  late Directory pasta;
  late UsuarioDeTeste dono;
  late UsuarioDeTeste manejo;
  late String animalId;

  setUp(() async {
    pasta = await Directory.systemTemp.createTemp('equilog-teste-');
    dono = await servidor.criarUsuario('Dono');
    manejo = await servidor.criarUsuario('Manejo');
    animalId = await servidor.criarAnimal(dono, 'Animal do teste');
    await servidor.conceder(dono, animalId, manejo, 'manejo');
  });

  tearDown(() async {
    await pasta.delete(recursive: true);
  });

  tearDownAll(servidor.fechar);

  Future<BaseLocal> abrirBase() => BaseLocal.abrir(caminho: p.join(pasta.path, 'equilog.db'), fabrica: databaseFactoryFfi);

  test('CT09 - registro em modo avião: gravação local pendente, sem perda', () async {
    final (api, transporte) = await apiDoAplicativo(manejo);
    final base = await abrirBase();
    final fila = FilaSincronizacao(base: base, api: api);

    transporte.modoAviao = true;
    final registrado = await fila.registrar(
      usuarioId: manejo.id,
      animalId: animalId,
      corpo: corpoManejo('Trato da manha', '2026-10-12T07:00:00-03:00'),
    );
    final resultado = await fila.processarFila(manejo.id);

    // o id foi gerado no aparelho, antes de qualquer envio
    expect(RegExp(r'^[0-9a-f-]{36}$').hasMatch(registrado.id), isTrue);
    expect(resultado.interrompidoSemConexao, isTrue);
    expect(resultado.sincronizados, 0);
    expect((await base.buscar(registrado.id))!.estado, EstadoSync.pendente);

    // sem perda: o registro sobrevive ao fechamento da base (app encerrado)
    await fila.encerrar();
    await base.fechar();
    final reaberta = await abrirBase();
    final pendentes = await reaberta.eventosPorEstado(manejo.id, EstadoSync.pendente);
    expect(pendentes.map((e) => e.id), [registrado.id]);
    expect(pendentes.single.corpo['titulo'], 'Trato da manha');

    // e nada chegou ao servidor
    final linha = await servidor.linhaDoTempo(dono, animalId);
    expect(linha['total'], 0);
    await reaberta.fechar();
  });

  test('CT10 - reconexão após registro local: sincronização automática em ordem cronológica', () async {
    final (api, transporte) = await apiDoAplicativo(manejo);
    final base = await abrirBase();
    final fila = FilaSincronizacao(base: base, api: api);
    final conectividade = StreamController<bool>();
    fila.escutarConectividade(conectividade.stream, () => manejo.id);

    transporte.modoAviao = true;
    // gravados fora de ordem cronologica
    final tarde = await fila.registrar(usuarioId: manejo.id, animalId: animalId, corpo: corpoManejo('Tarde', '2026-10-12T16:00:00-03:00'));
    final manha = await fila.registrar(usuarioId: manejo.id, animalId: animalId, corpo: corpoManejo('Manha', '2026-10-12T07:00:00-03:00'));
    final meioDia = await fila.registrar(usuarioId: manejo.id, animalId: animalId, corpo: corpoManejo('Meio-dia', '2026-10-12T12:00:00-03:00'));
    expect((await fila.processarFila(manejo.id)).interrompidoSemConexao, isTrue);
    expect(await base.contarPorEstado(manejo.id, EstadoSync.pendente), 3);

    // a conexao volta: o aviso de conectividade dispara o envio, sem acao do usuario
    transporte.modoAviao = false;
    final sincronizou = fila.alteracoes.first;
    conectividade.add(true);
    await sincronizou.timeout(const Duration(seconds: 30));

    expect(await base.contarPorEstado(manejo.id, EstadoSync.pendente), 0);
    for (final id in [manha.id, meioDia.id, tarde.id]) {
      expect((await base.buscar(id))!.estado, EstadoSync.sincronizado);
    }

    // o lote foi enviado em ordem cronologica do evento
    final lote = (jsonDecode(transporte.corposEnviados.last) as List).cast<Map<String, dynamic>>();
    expect(lote.map((e) => e['titulo']), ['Manha', 'Meio-dia', 'Tarde']);

    // e os tres estao na linha do tempo do servidor
    final linha = await servidor.linhaDoTempo(dono, animalId);
    expect(linha['total'], 3);
    expect((linha['itens'] as List).map((e) => e['titulo']), ['Tarde', 'Meio-dia', 'Manha']);

    await conectividade.close();
    await fila.encerrar();
    await base.fechar();
  });

  test('CT11 - reenvio de evento já sincronizado: idempotente, sem duplicar', () async {
    final (api, _) = await apiDoAplicativo(manejo);
    final base = await abrirBase();
    final fila = FilaSincronizacao(base: base, api: api);

    final evento = await fila.registrar(usuarioId: manejo.id, animalId: animalId, corpo: corpoManejo('Unico', '2026-10-12T09:00:00-03:00'));
    final primeiro = await fila.processarFila(manejo.id);
    expect(primeiro.sincronizados, 1);

    // a resposta se perdeu no caminho: o aparelho ainda acha que esta pendente
    await base.marcar(evento.id, EstadoSync.pendente);
    final reenvio = await fila.processarFila(manejo.id);
    expect(reenvio.enviados, 1);
    expect(reenvio.sincronizados, 1);
    expect((await base.buscar(evento.id))!.estado, EstadoSync.sincronizado);

    // e de novo, por garantia
    await base.marcar(evento.id, EstadoSync.pendente);
    await fila.processarFila(manejo.id);

    final linha = await servidor.linhaDoTempo(dono, animalId);
    expect(linha['total'], 1);
    expect((linha['itens'] as List).single['id'], evento.id);

    await fila.encerrar();
    await base.fechar();
  });

  test('409 - versão do servidor maior: conflito mantido na fila e sinalizado', () async {
    final (api, _) = await apiDoAplicativo(manejo);
    final base = await abrirBase();
    final fila = FilaSincronizacao(base: base, api: api);
    final conflitos = <String>[];
    fila.conflitos.listen((e) => conflitos.add(e.id));

    final evento = await fila.registrar(usuarioId: manejo.id, animalId: animalId, corpo: corpoManejo('Original', '2026-10-12T10:00:00-03:00'));
    await fila.processarFila(manejo.id);
    await servidor.editarEvento(manejo, evento.id, {'titulo': 'Alterado no servidor'});

    await base.marcar(evento.id, EstadoSync.pendente);
    final resultado = await fila.processarFila(manejo.id);

    expect(resultado.conflitos, 1);
    final local = (await base.buscar(evento.id))!;
    expect(local.estado, EstadoSync.conflito);
    expect(local.versaoServidor, 2);
    expect(conflitos, [evento.id]);
    // nao e reenviado automaticamente: permanece na fila para o usuario
    expect((await fila.processarFila(manejo.id)).enviados, 0);
    final linha = await servidor.linhaDoTempo(dono, animalId);
    expect((linha['itens'] as List).single['titulo'], 'Alterado no servidor');

    await fila.encerrar();
    await base.fechar();
  });

  test('403 - vínculo revogado após a gravação local: registro recusado, sem perda do conteúdo', () async {
    final treinador = await servidor.criarUsuario('Treinador');
    final vinculoId = await servidor.conceder(dono, animalId, treinador, 'treinador');
    final (api, transporte) = await apiDoAplicativo(treinador);
    final base = await abrirBase();
    final fila = FilaSincronizacao(base: base, api: api);

    transporte.modoAviao = true;
    final evento = await fila.registrar(
      usuarioId: treinador.id,
      animalId: animalId,
      corpo: {
        'dominio': 'treinamento',
        'tipoEvento': 'trabalho de tambor',
        'dataEvento': '2026-10-12T15:00:00-03:00',
        'titulo': 'Treino sem sinal',
        'detalhe': {'tipoExercicio': 'tambor'},
      },
    );
    await fila.processarFila(treinador.id);
    await servidor.revogar(dono, vinculoId);

    transporte.modoAviao = false;
    final resultado = await fila.processarFila(treinador.id);

    expect(resultado.recusados, 1);
    final local = (await base.buscar(evento.id))!;
    expect(local.estado, EstadoSync.recusado);
    expect(local.motivo, 'sem_vinculo');
    expect(local.corpo['titulo'], 'Treino sem sinal');
    expect((await servidor.linhaDoTempo(dono, animalId))['total'], 0);

    await fila.encerrar();
    await base.fechar();
  });
}
