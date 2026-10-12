// Apoio aos testes que exercitam o SERVIDOR REAL (nao ha simulacao do servico).
// Requer o servico no ar (docker compose up) e o certificado de desenvolvimento
// em servico/certs/servidor.crt. Endereco: EQUILOG_API_URL, ou
// https://127.0.0.1:3443 por padrao.
//
// A unica coisa simulada e a ausencia de rede no aparelho: ClienteModoAviao
// recusa toda requisicao na camada de transporte enquanto o modo avião estiver
// ativo, como acontece no aparelho sem sinal.

import 'dart:convert';
import 'dart:io';

import 'package:equilog/servicos/api_cliente.dart';
import 'package:equilog/servicos/armazenamento_credenciais.dart';
import 'package:equilog/servicos/cliente_http.dart';
import 'package:http/http.dart' as http;

final urlServidor = Platform.environment['EQUILOG_API_URL'] ?? 'https://127.0.0.1:3443';

List<int> certificadoDesenvolvimento() {
  final arquivo = File(Platform.environment['EQUILOG_CERTIFICADO'] ?? '../servico/certs/servidor.crt');
  if (!arquivo.existsSync()) {
    throw StateError('Certificado do servico nao encontrado em ${arquivo.absolute.path}. Suba o servico antes dos testes.');
  }
  return arquivo.readAsBytesSync();
}

class ClienteModoAviao extends http.BaseClient {
  final http.Client _interno;
  bool modoAviao = false;
  // corpos enviados ao servidor, na ordem, para verificacao
  final List<String> corposEnviados = [];

  ClienteModoAviao(this._interno);

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    if (modoAviao) throw const SocketException('Modo avião: sem rede');
    if (request is http.Request && request.body.isNotEmpty) corposEnviados.add(request.body);
    return _interno.send(request);
  }
}

class UsuarioDeTeste {
  final String id;
  final String nome;
  final String email;
  final String senha;
  UsuarioDeTeste(this.id, this.nome, this.email, this.senha);
}

// Acesso direto ao servidor para preparar cenarios (cadastro, concessao...)
class ServidorReal {
  final http.Client _http = criarClienteHttp(certificadoConfiavel: certificadoDesenvolvimento());
  static int _sequencia = 0;

  Future<dynamic> _chamar(String metodo, String caminho, {String? token, Object? corpo}) async {
    final requisicao = http.Request(metodo, Uri.parse('$urlServidor$caminho'))
      ..headers['Content-Type'] = 'application/json';
    if (token != null) requisicao.headers['Authorization'] = 'Bearer $token';
    if (corpo != null) requisicao.body = jsonEncode(corpo);
    final resposta = await http.Response.fromStream(await _http.send(requisicao));
    final texto = utf8.decode(resposta.bodyBytes);
    if (resposta.statusCode >= 400) throw StateError('$metodo $caminho -> ${resposta.statusCode} $texto');
    return texto.isEmpty ? null : jsonDecode(texto);
  }

  Future<UsuarioDeTeste> criarUsuario(String nome) async {
    _sequencia++;
    final email = '${nome.toLowerCase()}.${DateTime.now().microsecondsSinceEpoch}.$_sequencia@app.teste.equilog';
    const senha = 'senha-segura-123';
    final criado = await _chamar('POST', '/usuarios', corpo: {'nome': nome, 'email': email, 'senha': senha});
    return UsuarioDeTeste(criado['id'] as String, nome, email, senha);
  }

  Future<String> token(UsuarioDeTeste usuario) async {
    final corpo = await _chamar('POST', '/auth/login', corpo: {'email': usuario.email, 'senha': usuario.senha});
    return corpo['tokenAcesso'] as String;
  }

  Future<String> criarAnimal(UsuarioDeTeste dono, String nome) async {
    final corpo = await _chamar('POST', '/animais', token: await token(dono), corpo: {'nome': nome, 'sexo': 'F'});
    return corpo['id'] as String;
  }

  Future<String> conceder(UsuarioDeTeste dono, String animalId, UsuarioDeTeste convidado, String papel) async {
    final corpo = await _chamar('POST', '/animais/$animalId/acessos',
        token: await token(dono), corpo: {'email': convidado.email, 'papel': papel});
    return corpo['id'] as String;
  }

  Future<void> revogar(UsuarioDeTeste dono, String vinculoId) async =>
      _chamar('DELETE', '/acessos/$vinculoId', token: await token(dono));

  Future<Map<String, dynamic>> linhaDoTempo(UsuarioDeTeste usuario, String animalId) async =>
      await _chamar('GET', '/animais/$animalId/eventos?limite=100', token: await token(usuario)) as Map<String, dynamic>;

  Future<void> editarEvento(UsuarioDeTeste autor, String eventoId, Map<String, dynamic> alteracao) async =>
      _chamar('PATCH', '/eventos/$eventoId', token: await token(autor), corpo: alteracao);

  void fechar() => _http.close();
}

// Cliente da API do aplicativo, sobre o transporte com modo avião
Future<(ApiCliente, ClienteModoAviao)> apiDoAplicativo(UsuarioDeTeste usuario) async {
  final transporte = ClienteModoAviao(criarClienteHttp(certificadoConfiavel: certificadoDesenvolvimento()));
  final api = ApiCliente(urlBase: urlServidor, clienteHttp: transporte, credenciais: ArmazenamentoEmMemoria());
  await api.entrar(usuario.email, usuario.senha);
  return (api, transporte);
}
