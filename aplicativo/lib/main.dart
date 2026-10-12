// EquiLog: registro integrado de saude, manejo, treinamento e desempenho de
// equinos atletas. O aplicativo organiza informacoes fornecidas por pessoas e
// nao faz nenhuma inferencia clinica, sugestao ou recomendacao (RNF11).

import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'modelos/entidades.dart';
import 'servicos/api_cliente.dart';
import 'servicos/armazenamento_credenciais.dart';
import 'servicos/cliente_http.dart';
import 'servicos/configuracao.dart';
import 'servicos/dependencias.dart';
import 'servicos/equilog_servico.dart';
import 'servicos/notificacoes_servico.dart';
import 'sincronizacao/base_local.dart';
import 'sincronizacao/fila_sincronizacao.dart';
import 'telas/tela_animais.dart';
import 'telas/tela_login.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('pt_BR');

  final credenciais = ArmazenamentoSeguro();
  final api = ApiCliente(urlBase: urlApi, clienteHttp: await criarClienteHttpDoAplicativo(), credenciais: credenciais);
  final base = await BaseLocal.abrir();
  final notificacoes = NotificacoesServico();
  await notificacoes.inicializar();

  final dependencias = Dependencias(
    api: api,
    servico: EquilogServico(api),
    base: base,
    fila: FilaSincronizacao(base: base, api: api),
    notificacoes: notificacoes,
    usuario: await _restaurarSessao(api, credenciais),
  );

  // nova tentativa de envio a cada restabelecimento de conexao (RF21)
  dependencias.fila.escutarConectividade(
    Connectivity().onConnectivityChanged.map((r) => r.any((tipo) => tipo != ConnectivityResult.none)),
    () => dependencias.usuario?.id ?? '',
  );
  // e periodicamente enquanto o aplicativo esta aberto
  Timer.periodic(const Duration(minutes: 2), (_) => dependencias.sincronizar());

  runApp(EquilogApp(dependencias: dependencias));
  if (dependencias.usuario != null) unawaited(dependencias.sincronizar());
}

// Sessao anterior: com conexao, renova o token; sem conexao, segue com o
// usuario guardado, para que o registro local continue possivel.
Future<Usuario?> _restaurarSessao(ApiCliente api, ArmazenamentoCredenciais credenciais) async {
  final usuario = await credenciais.lerUsuario();
  if (usuario == null) return null;
  try {
    return await api.renovar() ? usuario : null;
  } on SemConexaoException {
    return usuario;
  }
}

class EquilogApp extends StatelessWidget {
  final Dependencias dependencias;
  const EquilogApp({super.key, required this.dependencias});

  @override
  Widget build(BuildContext context) {
    return ProvedorDependencias(
      dependencias: dependencias,
      child: MaterialApp(
        title: 'EquiLog',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(colorSchemeSeed: const Color(0xFF2E5E4E), useMaterial3: true),
        locale: const Locale('pt', 'BR'),
        supportedLocales: const [Locale('pt', 'BR')],
        localizationsDelegates: const [
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        home: dependencias.usuario == null ? const TelaLogin() : const TelaAnimais(),
      ),
    );
  }
}
