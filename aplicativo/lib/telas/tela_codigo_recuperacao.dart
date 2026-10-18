// Exibe o codigo de recuperacao de senha (decisao 9.7), que o servidor mostra
// uma unica vez: no cadastro e a cada recuperacao. So segue para o aplicativo
// depois que a pessoa confirma que anotou o codigo.

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../componentes/mensagens.dart';
import 'tela_animais.dart';

class TelaCodigoRecuperacao extends StatefulWidget {
  final String codigo;
  const TelaCodigoRecuperacao({super.key, required this.codigo});

  @override
  State<TelaCodigoRecuperacao> createState() => _TelaCodigoRecuperacaoState();
}

class _TelaCodigoRecuperacaoState extends State<TelaCodigoRecuperacao> {
  bool _anotado = false;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    // voltar descartaria o codigo sem que a pessoa o tivesse anotado
    return PopScope(
      canPop: false,
      child: Scaffold(
        appBar: AppBar(title: const Text('Código de recuperação'), automaticallyImplyLeading: false),
        body: SafeArea(
          child: ListView(padding: const EdgeInsets.all(24), children: [
            Icon(Icons.key, size: 48, color: tema.colorScheme.primary),
            const SizedBox(height: 16),
            const Text(
              'Anote este código e guarde em lugar seguro. Se esquecer a senha, ele é a única forma de criar uma nova. '
              'Ele não será mostrado de novo.',
            ),
            const SizedBox(height: 24),
            Container(
              padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 12),
              decoration: BoxDecoration(
                color: tema.colorScheme.surfaceContainerHighest,
                borderRadius: BorderRadius.circular(12),
              ),
              child: SelectableText(
                widget.codigo,
                key: const Key('codigo-recuperacao'),
                textAlign: TextAlign.center,
                style: tema.textTheme.headlineSmall?.copyWith(fontFamily: 'monospace', letterSpacing: 2),
              ),
            ),
            const SizedBox(height: 8),
            TextButton.icon(
              icon: const Icon(Icons.copy),
              label: const Text('Copiar código'),
              onPressed: () async {
                await Clipboard.setData(ClipboardData(text: widget.codigo));
                if (context.mounted) mostrarMensagem(context, 'Código copiado.');
              },
            ),
            const SizedBox(height: 8),
            CheckboxListTile(
              key: const Key('codigo-anotado'),
              value: _anotado,
              onChanged: (v) => setState(() => _anotado = v ?? false),
              controlAffinity: ListTileControlAffinity.leading,
              contentPadding: EdgeInsets.zero,
              title: const Text('Anotei o código em lugar seguro'),
            ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: _anotado
                  ? () => Navigator.of(context)
                      .pushAndRemoveUntil(MaterialPageRoute(builder: (_) => const TelaAnimais()), (_) => false)
                  : null,
              style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52)),
              child: const Text('Continuar'),
            ),
          ]),
        ),
      ),
    );
  }
}
