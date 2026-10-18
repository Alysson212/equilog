// Cliente da API REST do EquiLog. Envia o token de acesso em cada requisicao,
// renova-o com o token de renovacao quando expira (RF03) e converte falhas de
// rede em SemConexaoException, usada pela fila de sincronizacao (RF21).

import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import '../modelos/entidades.dart';
import 'armazenamento_credenciais.dart';

class SemConexaoException implements Exception {
  const SemConexaoException();
  @override
  String toString() => 'Sem conexão com o servidor.';
}

class SessaoExpiradaException implements Exception {
  const SessaoExpiradaException();
  @override
  String toString() => 'Sua sessão expirou. Entre novamente.';
}

class ErroApi implements Exception {
  final int status;
  final String mensagem;
  final List<Map<String, dynamic>> campos;

  const ErroApi(this.status, this.mensagem, [this.campos = const []]);

  @override
  String toString() => mensagem;
}

class ApiCliente {
  final String urlBase;
  final http.Client _http;
  final ArmazenamentoCredenciais credenciais;
  String? _tokenAcesso;
  Future<bool>? _renovacaoEmAndamento;

  ApiCliente({required this.urlBase, required http.Client clienteHttp, required this.credenciais}) : _http = clienteHttp;

  bool get autenticado => _tokenAcesso != null;

  Future<Usuario> entrar(String email, String senha) async {
    final corpo = await _requisitar('POST', '/auth/login', corpo: {'email': email, 'senha': senha}, autenticar: false);
    final usuario = Usuario.deJson(corpo['usuario'] as Map<String, dynamic>);
    _tokenAcesso = corpo['tokenAcesso'] as String;
    await credenciais.gravarTokenRenovacao(corpo['tokenRenovacao'] as String);
    await credenciais.gravarUsuario(usuario);
    return usuario;
  }

  // Cadastro publico (RF01) seguido de autenticacao com as mesmas credenciais
  Future<Usuario> cadastrar({
    required String nome,
    required String email,
    String? telefone,
    required String senha,
  }) async {
    await _requisitar(
      'POST',
      '/usuarios',
      corpo: {'nome': nome, 'email': email, 'telefone': ?telefone, 'senha': senha},
      autenticar: false,
    );
    return entrar(email, senha);
  }

  // Restaura a sessao a partir do token de renovacao guardado
  Future<bool> renovar() {
    return _renovacaoEmAndamento ??= _renovar().whenComplete(() => _renovacaoEmAndamento = null);
  }

  Future<bool> _renovar() async {
    final token = await credenciais.lerTokenRenovacao();
    if (token == null) return false;
    try {
      final corpo = await _requisitar('POST', '/auth/refresh', corpo: {'tokenRenovacao': token}, autenticar: false);
      _tokenAcesso = corpo['tokenAcesso'] as String;
      await credenciais.gravarTokenRenovacao(corpo['tokenRenovacao'] as String);
      return true;
    } on ErroApi catch (erro) {
      if (erro.status == 401) {
        _tokenAcesso = null;
        return false;
      }
      rethrow;
    }
  }

  Future<void> sair() async {
    _tokenAcesso = null;
    await credenciais.apagar();
  }

  Future<dynamic> get(String caminho, {Map<String, String>? consulta}) =>
      _requisitar('GET', caminho, consulta: consulta);

  Future<dynamic> post(String caminho, Object? corpo) => _requisitar('POST', caminho, corpo: corpo);

  Future<dynamic> patch(String caminho, Object? corpo) => _requisitar('PATCH', caminho, corpo: corpo);

  Future<dynamic> delete(String caminho) => _requisitar('DELETE', caminho);

  Future<dynamic> _requisitar(
    String metodo,
    String caminho, {
    Object? corpo,
    Map<String, String>? consulta,
    bool autenticar = true,
    bool podeRenovar = true,
  }) async {
    if (autenticar && _tokenAcesso == null) {
      if (!await renovar()) throw const SessaoExpiradaException();
    }

    final uri = Uri.parse('$urlBase$caminho').replace(queryParameters: consulta);
    final requisicao = http.Request(metodo, uri)..headers['Accept'] = 'application/json';
    if (autenticar) requisicao.headers['Authorization'] = 'Bearer $_tokenAcesso';
    if (corpo != null) {
      requisicao.headers['Content-Type'] = 'application/json; charset=utf-8';
      requisicao.body = jsonEncode(corpo);
    }

    final http.Response resposta;
    try {
      resposta = await http.Response.fromStream(await _http.send(requisicao).timeout(const Duration(seconds: 20)));
    } on SocketException {
      throw const SemConexaoException();
    } on HandshakeException {
      throw const SemConexaoException();
    } on TimeoutException {
      throw const SemConexaoException();
    } on http.ClientException {
      throw const SemConexaoException();
    }

    if (resposta.statusCode == 401 && autenticar && podeRenovar) {
      _tokenAcesso = null;
      if (await renovar()) {
        return _requisitar(metodo, caminho, corpo: corpo, consulta: consulta, podeRenovar: false);
      }
      throw const SessaoExpiradaException();
    }

    final texto = utf8.decode(resposta.bodyBytes);
    final dados = texto.isEmpty ? null : jsonDecode(texto);
    if (resposta.statusCode >= 400) {
      final mapa = dados is Map<String, dynamic> ? dados : const <String, dynamic>{};
      throw ErroApi(
        resposta.statusCode,
        (mapa['erro'] as String?) ?? 'Não foi possível concluir a operação.',
        ((mapa['campos'] as List?) ?? const []).cast<Map<String, dynamic>>(),
      );
    }
    return dados;
  }
}
