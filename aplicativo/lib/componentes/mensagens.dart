// Mensagens ao usuario em linguagem comum (RNF08). Erros da API trazem texto
// ja redigido pelo servidor; falhas de rede viram uma frase simples.

import 'package:flutter/material.dart';

import '../servicos/api_cliente.dart';

String textoDoErro(Object erro) {
  if (erro is ErroApi) return erro.mensagem;
  if (erro is SemConexaoException) return 'Sem conexão no momento. Tente de novo quando houver sinal.';
  if (erro is SessaoExpiradaException) return 'Sua sessão expirou. Entre novamente.';
  return 'Algo não saiu como esperado. Tente novamente.';
}

void mostrarMensagem(BuildContext context, String texto, {bool erro = false}) {
  final tema = Theme.of(context);
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(
      content: Text(texto),
      backgroundColor: erro ? tema.colorScheme.error : null,
    ));
}

void mostrarErro(BuildContext context, Object erro) => mostrarMensagem(context, textoDoErro(erro), erro: true);

Future<bool> confirmar(BuildContext context, {required String titulo, required String texto, String acao = 'Confirmar'}) async {
  final resposta = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(titulo),
      content: Text(texto),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Voltar')),
        FilledButton(onPressed: () => Navigator.pop(context, true), child: Text(acao)),
      ],
    ),
  );
  return resposta ?? false;
}

class AvisoVazio extends StatelessWidget {
  final IconData icone;
  final String texto;
  const AvisoVazio({super.key, required this.icone, required this.texto});

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Icon(icone, size: 48, color: Theme.of(context).colorScheme.outline),
            const SizedBox(height: 12),
            Text(texto, textAlign: TextAlign.center),
          ]),
        ),
      );
}
