// Guarda do token de renovacao (RF03) e do usuario da sessao. O token de
// renovacao fica no repositorio seguro do sistema (Keystore no Android); o
// token de acesso, de 15 minutos, fica apenas em memoria.

import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../modelos/entidades.dart';

abstract class ArmazenamentoCredenciais {
  Future<String?> lerTokenRenovacao();
  Future<void> gravarTokenRenovacao(String token);
  Future<Usuario?> lerUsuario();
  Future<void> gravarUsuario(Usuario usuario);
  Future<void> apagar();
}

class ArmazenamentoSeguro implements ArmazenamentoCredenciais {
  static const _chaveToken = 'token_renovacao';
  static const _chaveUsuario = 'usuario';
  final FlutterSecureStorage _armazenamento;

  ArmazenamentoSeguro([FlutterSecureStorage? armazenamento])
      : _armazenamento = armazenamento ?? const FlutterSecureStorage();

  @override
  Future<String?> lerTokenRenovacao() => _armazenamento.read(key: _chaveToken);

  @override
  Future<void> gravarTokenRenovacao(String token) => _armazenamento.write(key: _chaveToken, value: token);

  @override
  Future<Usuario?> lerUsuario() async {
    final texto = await _armazenamento.read(key: _chaveUsuario);
    return texto == null ? null : Usuario.deJson(jsonDecode(texto) as Map<String, dynamic>);
  }

  @override
  Future<void> gravarUsuario(Usuario usuario) =>
      _armazenamento.write(key: _chaveUsuario, value: jsonEncode(usuario.paraJson()));

  @override
  Future<void> apagar() async {
    await _armazenamento.delete(key: _chaveToken);
    await _armazenamento.delete(key: _chaveUsuario);
  }
}

// Usado nos testes, que rodam fora do aparelho
class ArmazenamentoEmMemoria implements ArmazenamentoCredenciais {
  String? _token;
  Usuario? _usuario;

  @override
  Future<String?> lerTokenRenovacao() async => _token;

  @override
  Future<void> gravarTokenRenovacao(String token) async => _token = token;

  @override
  Future<Usuario?> lerUsuario() async => _usuario;

  @override
  Future<void> gravarUsuario(Usuario usuario) async => _usuario = usuario;

  @override
  Future<void> apagar() async {
    _token = null;
    _usuario = null;
  }
}
