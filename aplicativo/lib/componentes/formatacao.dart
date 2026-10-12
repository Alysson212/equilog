// Formatacao de datas para exibicao (dd/mm/aaaa) no fuso do aparelho.

import 'package:intl/intl.dart';

final _data = DateFormat('dd/MM/yyyy');
final _dataHora = DateFormat('dd/MM/yyyy HH:mm');
final _iso = DateFormat('yyyy-MM-dd');

String exibirData(DateTime data) => _data.format(data.toLocal());

String exibirDataHora(DateTime instante) => _dataHora.format(instante.toLocal());

// AAAA-MM-DD -> dd/mm/aaaa
String exibirDataIso(String texto) => _data.format(DateTime.parse(texto));

String paraDataIso(DateTime data) => _iso.format(data);

// Instante com deslocamento explicito, formato exigido pela API
String paraDataHoraIso(DateTime instante) {
  final local = instante.toLocal();
  final deslocamento = local.timeZoneOffset;
  final sinal = deslocamento.isNegative ? '-' : '+';
  final horas = deslocamento.inHours.abs().toString().padLeft(2, '0');
  final minutos = (deslocamento.inMinutes.abs() % 60).toString().padLeft(2, '0');
  return '${DateFormat("yyyy-MM-dd'T'HH:mm:ss").format(local)}$sinal$horas:$minutos';
}
