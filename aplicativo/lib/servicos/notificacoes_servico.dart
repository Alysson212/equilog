// Notificacoes locais dos lembretes (RF18). O aplicativo consulta os lembretes
// em aberto e agenda no proprio sistema operacional uma notificacao na data
// prevista, de modo que ela seja emitida mesmo sem conexao naquele momento.
// A data e a informada por uma pessoa; nada e calculado (RNF11).
//
// O lembrete marcado como cumprido, adiado ou cancelado tem a notificacao
// cancelada ou reagendada na proxima sincronizacao do agendamento (CT15).

import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:timezone/data/latest_all.dart' as tzdados;
import 'package:timezone/timezone.dart' as tz;

import '../modelos/entidades.dart';
import 'configuracao.dart';

// Horario do dia em que a notificacao e emitida na data prevista
const horaNotificacao = 8;

class NotificacoesServico {
  final FlutterLocalNotificationsPlugin _plugin;

  NotificacoesServico([FlutterLocalNotificationsPlugin? plugin])
      : _plugin = plugin ?? FlutterLocalNotificationsPlugin();

  static void inicializarFusos() {
    tzdados.initializeTimeZones();
    tz.setLocalLocation(tz.getLocation(fusoHorario));
  }

  Future<void> inicializar() async {
    inicializarFusos();
    await _plugin.initialize(
      settings: const InitializationSettings(android: AndroidInitializationSettings('@mipmap/ic_launcher')),
    );
    await _plugin
        .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
        ?.requestNotificationsPermission();
  }

  // Identificador inteiro estavel derivado do UUID do lembrete
  static int idDaNotificacao(String lembreteId) =>
      int.parse(lembreteId.replaceAll('-', '').substring(0, 7), radix: 16);

  // Instante da notificacao: data prevista, no horario fixo, no fuso local
  static tz.TZDateTime instanteDaNotificacao(String dataPrevista) {
    final partes = dataPrevista.split('-').map(int.parse).toList();
    return tz.TZDateTime(tz.local, partes[0], partes[1], partes[2], horaNotificacao);
  }

  // Reflete no sistema a lista atual de lembretes: cancela a notificacao do
  // lembrete que deixou de estar em aberto (cumprido ou cancelado), agenda os
  // em aberto com data futura e nao mexe nos em aberto ja vencidos, cuja
  // notificacao pode estar sendo exibida.
  Future<void> sincronizarAgendamentos(List<Lembrete> lembretes) async {
    final agora = tz.TZDateTime.now(tz.local);
    for (final lembrete in lembretes) {
      final id = idDaNotificacao(lembrete.id);
      final instante = instanteDaNotificacao(lembrete.dataPrevista);
      if (!lembrete.emAberto) {
        await _plugin.cancel(id: id);
        continue;
      }
      if (instante.isBefore(agora)) continue;
      await _plugin.zonedSchedule(
        id: id,
        title: 'Lembrete: ${lembrete.animalNome}',
        body: lembrete.eventoTitulo == null
            ? 'Há um lembrete para hoje.'
            : 'Retorno previsto: ${lembrete.eventoTitulo}',
        scheduledDate: instante,
        notificationDetails: const NotificationDetails(
          android: AndroidNotificationDetails(
            'lembretes',
            'Lembretes',
            channelDescription: 'Datas de retorno informadas nos registros',
            importance: Importance.high,
            priority: Priority.high,
          ),
        ),
        androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
        payload: lembrete.id,
      );
    }
  }

  Future<void> cancelar(String lembreteId) => _plugin.cancel(id: idDaNotificacao(lembreteId));
}
