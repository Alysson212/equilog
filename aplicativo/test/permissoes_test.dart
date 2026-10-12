// A copia da matriz no aplicativo (conveniencia visual) deve coincidir com o
// Quadro 8; a decisao real continua no servidor.

import 'package:equilog/modelos/permissoes.dart';
import 'package:flutter_test/flutter_test.dart';

const quadro8 = {
  'saude': ['L', 'C,L,E', 'L', '-'],
  'manejo': ['C,L,E', 'L', 'L', 'C,L,E'],
  'treinamento': ['C,L,E', 'L', 'C,L,E', 'L'],
  'competicao': ['C,L,E', '-', 'C,L,E', '-'],
  'animal': ['C,L,E', 'L', 'L', 'L'],
  'acesso': ['C,L,E', '-', '-', '-'],
  'anexo': ['C,L', 'C,L', 'C,L', 'L'],
  'lembrete': ['L,E', 'C,L,E', 'L,E', 'L'],
  'exportacao': ['C,L', 'L', 'L', '-'],
  'auditoria': ['L', '-', '-', '-'],
};
const papeis = ['proprietario', 'veterinario', 'treinador', 'manejo'];
const letras = {Acao.criar: 'C', Acao.ler: 'L', Acao.editar: 'E'};

void main() {
  test('120 combinacoes iguais ao Quadro 8', () {
    var verificadas = 0;
    quadro8.forEach((operacao, celulas) {
      for (var i = 0; i < papeis.length; i++) {
        for (final acao in Acao.values) {
          final esperado = celulas[i] != '-' && celulas[i].split(',').contains(letras[acao]);
          expect(papelPode(papeis[i], acao, operacao), esperado, reason: '$operacao/${papeis[i]}/${acao.name}');
          verificadas++;
        }
      }
    });
    expect(verificadas, 120);
  });

  test('formulario oferece apenas dominios registraveis pelo papel', () {
    expect(dominiosRegistraveis('veterinario'), ['saude']);
    expect(dominiosRegistraveis('manejo'), ['manejo']);
    expect(dominiosRegistraveis('treinador'), ['treinamento', 'competicao']);
    expect(dominiosRegistraveis('proprietario'), ['manejo', 'treinamento', 'competicao']);
    expect(dominiosLegiveis('manejo'), isNot(contains('saude')));
  });
}
