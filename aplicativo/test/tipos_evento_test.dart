// Tipos de evento vindos de GET /tipos-evento (servidor real), com a ultima
// lista recebida e o conjunto local como contingencia sem conexao.

import 'dart:io';

import 'package:equilog/modelos/formularios_evento.dart';
import 'package:equilog/servicos/dependencias.dart';
import 'package:equilog/servicos/equilog_servico.dart';
import 'package:equilog/servicos/notificacoes_servico.dart';
import 'package:equilog/sincronizacao/base_local.dart';
import 'package:equilog/sincronizacao/fila_sincronizacao.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:path/path.dart' as p;
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

import 'apoio_servidor.dart';

void main() {
  sqfliteFfiInit();
  final servidor = ServidorReal();
  late Directory pasta;

  setUp(() async => pasta = await Directory.systemTemp.createTemp('equilog-tipos-'));
  tearDown(() async => pasta.delete(recursive: true));
  tearDownAll(servidor.fechar);

  Future<(Dependencias, ClienteModoAviao, BaseLocal)> montar() async {
    final usuario = await servidor.criarUsuario('Tipos');
    final (api, transporte) = await apiDoAplicativo(usuario);
    final base = await BaseLocal.abrir(caminho: p.join(pasta.path, 'equilog.db'), fabrica: databaseFactoryFfi);
    final dependencias = Dependencias(
      api: api,
      servico: EquilogServico(api),
      base: base,
      fila: FilaSincronizacao(base: base, api: api),
      notificacoes: NotificacoesServico(),
    );
    return (dependencias, transporte, base);
  }

  test('com conexão, os tipos vêm do servidor e coincidem com a carga da especificação', () async {
    final (dependencias, _, base) = await montar();
    final (tipos, origem) = await dependencias.tiposEvento();

    expect(origem, OrigemTipos.servidor);
    expect(tipos.values.expand((t) => t).length, 27);
    for (final dominio in tiposDeContingencia.keys) {
      expect(tipos[dominio]!.toSet(), tiposDeContingencia[dominio]!.toSet(), reason: dominio);
    }
    // RNF07 tambem para os tipos recebidos do servidor
    tipos.forEach((dominio, lista) {
      for (final tipo in lista) {
        expect(contarObrigatorios(dominio, tipo), lessThanOrEqualTo(5));
      }
    });
    await base.fechar();
  });

  test('sem conexão, usa a última lista recebida', () async {
    final (dependencias, transporte, base) = await montar();
    await dependencias.tiposEvento(); // com conexao: guarda a lista no aparelho

    transporte.modoAviao = true;
    final (tipos, origem) = await dependencias.tiposEvento();

    expect(origem, OrigemTipos.ultimaListaRecebida);
    expect(tipos.values.expand((t) => t).length, 27);
    await base.fechar();
  });

  test('sem conexão e sem lista anterior, recorre ao conjunto de contingência', () async {
    final (dependencias, transporte, base) = await montar();
    transporte.modoAviao = true;

    final (tipos, origem) = await dependencias.tiposEvento();

    expect(origem, OrigemTipos.contingencia);
    expect(identical(tipos, tiposDeContingencia), isTrue);
    await base.fechar();
  });
}
