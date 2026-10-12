// RNF07: nenhum evento de rotina exige mais de cinco campos obrigatorios.
// Tipos de evento: espelho da carga inicial da especificacao (secao 3).

import 'package:equilog/modelos/formularios_evento.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('nenhum tipo de nenhum dominio exige mais de cinco campos obrigatorios', () {
    for (final MapEntry(key: dominio, value: tipos) in tiposPorDominio.entries) {
      for (final tipo in tipos) {
        expect(contarObrigatorios(dominio, tipo), lessThanOrEqualTo(5), reason: '$dominio / ${tipo.nome}');
      }
    }
  });

  test('obrigatorios por dominio: tipo, data, titulo e o atributo principal', () {
    expect(contarObrigatorios('manejo', tiposPorDominio['manejo']!.first), 4);
    expect(contarObrigatorios('treinamento', tiposPorDominio['treinamento']!.first), 4);
    expect(contarObrigatorios('competicao', tiposPorDominio['competicao']!.first), 4);
    // vacinacao exige a data de retorno no formulario: cinco no total
    expect(contarObrigatorios('saude', const TipoEvento('vacinacao', exigeRetorno: true)), 5);
    expect(contarObrigatorios('saude', const TipoEvento('exame')), 4);
  });

  test('carga de tipos igual a da especificacao, exige_retorno apenas em saude', () {
    expect(tiposPorDominio.values.expand((t) => t).length, 27);
    expect(tiposPorDominio['saude']!.where((t) => t.exigeRetorno).map((t) => t.nome),
        ['vacinacao', 'vermifugacao', 'procedimento odontologico']);
    for (final dominio in ['manejo', 'treinamento', 'competicao']) {
      expect(tiposPorDominio[dominio]!.any((t) => t.exigeRetorno), isFalse);
    }
  });

  test('cada dominio tem exatamente um atributo especifico obrigatorio', () {
    for (final campos in camposPorDominio.values) {
      expect(campos.where((c) => c.obrigatorio), hasLength(1));
    }
  });
}
