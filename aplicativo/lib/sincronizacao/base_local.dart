// Base local do dispositivo (SQLite via sqflite; RF21, RNF06).
// Guarda cada evento registrado no aparelho, com o identificador gerado no
// cliente e o estado de sincronizacao, antes de qualquer tentativa de envio.

import 'dart:convert';

import 'package:path/path.dart' as p;
import 'package:sqflite/sqflite.dart';

enum EstadoSync { pendente, sincronizado, conflito, recusado }

class EventoLocal {
  final String id;
  final String usuarioId;
  final String animalId;
  final String dominio;
  final DateTime dataEvento;
  // corpo completo do evento, no formato da API (especificacao, secao 5)
  final Map<String, dynamic> corpo;
  final int versao;
  final EstadoSync estado;
  final int? versaoServidor;
  final String? motivo;

  const EventoLocal({
    required this.id,
    required this.usuarioId,
    required this.animalId,
    required this.dominio,
    required this.dataEvento,
    required this.corpo,
    this.versao = 1,
    this.estado = EstadoSync.pendente,
    this.versaoServidor,
    this.motivo,
  });

  factory EventoLocal._daLinha(Map<String, Object?> linha) => EventoLocal(
        id: linha['id'] as String,
        usuarioId: linha['usuario_id'] as String,
        animalId: linha['animal_id'] as String,
        dominio: linha['dominio'] as String,
        dataEvento: DateTime.fromMillisecondsSinceEpoch(linha['data_evento_ms'] as int, isUtc: true),
        corpo: jsonDecode(linha['corpo'] as String) as Map<String, dynamic>,
        versao: linha['versao'] as int,
        estado: EstadoSync.values.byName(linha['estado'] as String),
        versaoServidor: linha['versao_servidor'] as int?,
        motivo: linha['motivo'] as String?,
      );

  // item do lote: corpo do evento + animal e versao conhecida (decisao 9.3)
  Map<String, dynamic> paraItemDeLote() => {...corpo, 'id': id, 'animalId': animalId, 'versao': versao};
}

class BaseLocal {
  static const _versaoEsquema = 1;
  final Database _db;

  BaseLocal._(this._db);

  static Future<BaseLocal> abrir({String? caminho, DatabaseFactory? fabrica}) async {
    final f = fabrica ?? databaseFactory;
    final arquivo = caminho ?? p.join(await f.getDatabasesPath(), 'equilog.db');
    final db = await f.openDatabase(
      arquivo,
      options: OpenDatabaseOptions(
        version: _versaoEsquema,
        onCreate: (db, versao) async {
          await db.execute('''
            CREATE TABLE evento_local (
              id              TEXT PRIMARY KEY,
              usuario_id      TEXT NOT NULL,
              animal_id       TEXT NOT NULL,
              dominio         TEXT NOT NULL,
              data_evento_ms  INTEGER NOT NULL,
              corpo           TEXT NOT NULL,
              versao          INTEGER NOT NULL DEFAULT 1,
              estado          TEXT NOT NULL
                CHECK (estado IN ('pendente', 'sincronizado', 'conflito', 'recusado')),
              versao_servidor INTEGER,
              motivo          TEXT,
              gravado_em      INTEGER NOT NULL
            )''');
          await db.execute('CREATE INDEX idx_evento_local_estado ON evento_local (usuario_id, estado, data_evento_ms)');
          // ultima resposta conhecida de consultas, para abrir o aplicativo sem conexao
          await db.execute('CREATE TABLE cache_consulta (chave TEXT PRIMARY KEY, valor TEXT NOT NULL)');
        },
      ),
    );
    return BaseLocal._(db);
  }

  Future<void> fechar() => _db.close();

  Future<void> inserir(EventoLocal evento) => _db.insert('evento_local', {
        'id': evento.id,
        'usuario_id': evento.usuarioId,
        'animal_id': evento.animalId,
        'dominio': evento.dominio,
        'data_evento_ms': evento.dataEvento.millisecondsSinceEpoch,
        'corpo': jsonEncode(evento.corpo),
        'versao': evento.versao,
        'estado': evento.estado.name,
        'gravado_em': DateTime.now().millisecondsSinceEpoch,
      });

  // Em ordem cronologica do evento, para preservar a coerencia da linha do tempo
  Future<List<EventoLocal>> eventosPorEstado(String usuarioId, EstadoSync estado) async {
    final linhas = await _db.query(
      'evento_local',
      where: 'usuario_id = ? AND estado = ?',
      whereArgs: [usuarioId, estado.name],
      orderBy: 'data_evento_ms ASC, gravado_em ASC',
    );
    return linhas.map(EventoLocal._daLinha).toList();
  }

  // Registros do animal ainda nao confirmados pelo servidor
  Future<List<EventoLocal>> naoSincronizadosDoAnimal(String usuarioId, String animalId) async {
    final linhas = await _db.query(
      'evento_local',
      where: "usuario_id = ? AND animal_id = ? AND estado != 'sincronizado'",
      whereArgs: [usuarioId, animalId],
      orderBy: 'data_evento_ms DESC',
    );
    return linhas.map(EventoLocal._daLinha).toList();
  }

  Future<EventoLocal?> buscar(String id) async {
    final linhas = await _db.query('evento_local', where: 'id = ?', whereArgs: [id]);
    return linhas.isEmpty ? null : EventoLocal._daLinha(linhas.first);
  }

  Future<void> marcar(String id, EstadoSync estado, {int? versaoServidor, String? motivo}) => _db.update(
        'evento_local',
        {'estado': estado.name, 'versao_servidor': versaoServidor, 'motivo': motivo},
        where: 'id = ?',
        whereArgs: [id],
      );

  Future<void> guardarCache(String chave, Object valor) => _db.insert(
        'cache_consulta',
        {'chave': chave, 'valor': jsonEncode(valor)},
        conflictAlgorithm: ConflictAlgorithm.replace,
      );

  Future<dynamic> lerCache(String chave) async {
    final linhas = await _db.query('cache_consulta', where: 'chave = ?', whereArgs: [chave]);
    return linhas.isEmpty ? null : jsonDecode(linhas.first['valor'] as String);
  }

  Future<int> contarPorEstado(String usuarioId, EstadoSync estado) async {
    final resultado = await _db.rawQuery(
      'SELECT COUNT(*) AS total FROM evento_local WHERE usuario_id = ? AND estado = ?',
      [usuarioId, estado.name],
    );
    return resultado.first['total'] as int;
  }
}
