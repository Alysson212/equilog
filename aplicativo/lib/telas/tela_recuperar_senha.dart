// Recuperacao de senha sem e-mail (decisao 9.7): a pessoa informa o e-mail, o
// codigo de recuperacao recebido no cadastro e a nova senha. Em seguida entra
// no aplicativo e recebe um novo codigo, porque o anterior deixa de valer.

import 'package:flutter/material.dart';

import '../componentes/mensagens.dart';
import '../servicos/dependencias.dart';
import 'tela_codigo_recuperacao.dart';

class TelaRecuperarSenha extends StatefulWidget {
  // e-mail ja digitado na tela de login, se houver
  final String email;
  const TelaRecuperarSenha({super.key, this.email = ''});

  @override
  State<TelaRecuperarSenha> createState() => _TelaRecuperarSenhaState();
}

class _TelaRecuperarSenhaState extends State<TelaRecuperarSenha> {
  final _formulario = GlobalKey<FormState>();
  late final _email = TextEditingController(text: widget.email);
  final _codigo = TextEditingController();
  final _senha = TextEditingController();
  final _confirmacao = TextEditingController();
  bool _enviando = false;
  bool _senhaVisivel = false;

  @override
  void dispose() {
    for (final controlador in [_email, _codigo, _senha, _confirmacao]) {
      controlador.dispose();
    }
    super.dispose();
  }

  Future<void> _recuperar() async {
    if (!_formulario.currentState!.validate()) return;
    setState(() => _enviando = true);
    final dependencias = Dependencias.de(context);
    try {
      final (usuario, novoCodigo) = await dependencias.api.recuperarSenha(
        email: _email.text.trim(),
        codigoRecuperacao: _codigo.text.trim(),
        novaSenha: _senha.text,
      );
      dependencias.usuario = usuario;
      if (!mounted) return;
      Navigator.of(context)
          .pushAndRemoveUntil(MaterialPageRoute(builder: (_) => TelaCodigoRecuperacao(codigo: novoCodigo)), (_) => false);
      dependencias.sincronizar();
    } catch (erro) {
      if (mounted) mostrarErro(context, erro);
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Esqueci a senha')),
      body: SafeArea(
        child: Form(
          key: _formulario,
          child: ListView(padding: const EdgeInsets.all(24), children: [
            const Text('Informe o código de recuperação que você anotou ao criar a conta e escolha uma nova senha.'),
            const SizedBox(height: 24),
            TextFormField(
              key: const Key('recuperar-email'),
              controller: _email,
              keyboardType: TextInputType.emailAddress,
              autocorrect: false,
              autofillHints: const [AutofillHints.email],
              decoration: const InputDecoration(labelText: 'E-mail', border: OutlineInputBorder()),
              validator: (v) => (v == null || v.trim().isEmpty) ? 'Informe o e-mail.' : null,
            ),
            const SizedBox(height: 16),
            TextFormField(
              key: const Key('recuperar-codigo'),
              controller: _codigo,
              autocorrect: false,
              enableSuggestions: false,
              textCapitalization: TextCapitalization.characters,
              decoration: const InputDecoration(
                labelText: 'Código de recuperação',
                hintText: 'XXXX-XXXX-XXXX',
                border: OutlineInputBorder(),
              ),
              validator: (v) => (v == null || v.trim().isEmpty) ? 'Informe o código de recuperação.' : null,
            ),
            const SizedBox(height: 16),
            TextFormField(
              key: const Key('recuperar-senha'),
              controller: _senha,
              obscureText: !_senhaVisivel,
              autofillHints: const [AutofillHints.newPassword],
              decoration: InputDecoration(
                labelText: 'Nova senha',
                helperText: 'Pelo menos 8 caracteres.',
                border: const OutlineInputBorder(),
                suffixIcon: IconButton(
                  tooltip: _senhaVisivel ? 'Ocultar senha' : 'Mostrar senha',
                  icon: Icon(_senhaVisivel ? Icons.visibility_off : Icons.visibility),
                  onPressed: () => setState(() => _senhaVisivel = !_senhaVisivel),
                ),
              ),
              validator: (v) {
                if (v == null || v.isEmpty) return 'Informe a nova senha.';
                if (v.length < 8) return 'A senha deve ter pelo menos 8 caracteres.';
                return null;
              },
            ),
            const SizedBox(height: 16),
            TextFormField(
              key: const Key('recuperar-confirmacao'),
              controller: _confirmacao,
              obscureText: !_senhaVisivel,
              decoration: const InputDecoration(labelText: 'Repita a nova senha', border: OutlineInputBorder()),
              validator: (v) => v != _senha.text ? 'As senhas não são iguais.' : null,
            ),
            const SizedBox(height: 24),
            FilledButton(
              onPressed: _enviando ? null : _recuperar,
              style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52)),
              child: _enviando
                  ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Text('Criar nova senha'),
            ),
          ]),
        ),
      ),
    );
  }
}
