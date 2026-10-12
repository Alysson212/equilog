// Cliente HTTP do aplicativo. A comunicacao e sempre HTTPS (RNF02).
// Em desenvolvimento, o servico usa certificado autoassinado: o aplicativo
// passa a confiar nele somente se o arquivo estiver empacotado em
// assets/certificados/servidor.crt (copiado de servico/certs). Nao ha
// desativacao generica da verificacao de certificado.

import 'dart:io';

import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import 'package:http/io_client.dart';

const _certificadoDesenvolvimento = 'assets/certificados/servidor.crt';

http.Client criarClienteHttp({List<int>? certificadoConfiavel}) {
  final contexto = SecurityContext(withTrustedRoots: true);
  if (certificadoConfiavel != null) contexto.setTrustedCertificatesBytes(certificadoConfiavel);
  final cliente = HttpClient(context: contexto)..connectionTimeout = const Duration(seconds: 10);
  return IOClient(cliente);
}

Future<http.Client> criarClienteHttpDoAplicativo() async {
  List<int>? certificado;
  try {
    final dados = await rootBundle.load(_certificadoDesenvolvimento);
    certificado = dados.buffer.asUint8List();
  } catch (_) {
    certificado = null; // sem certificado empacotado: apenas as raizes do sistema
  }
  return criarClienteHttp(certificadoConfiavel: certificado);
}
