// Cadastro de usuario (RF01). Apenas nome, e-mail e telefone (RNF12); o
// telefone e opcional. Concluido o cadastro, a pessoa ja entra no aplicativo.

import 'package:flutter/material.dart';

import '../componentes/mensagens.dart';
import '../servicos/dependencias.dart';
import 'tela_animais.dart';

class TelaCadastro extends StatefulWidget {
  const TelaCadastro({super.key});

  @override
  State<TelaCadastro> createState() => _TelaCadastroState();
}

class _TelaCadastroState extends State<TelaCadastro> {
  final _formulario = GlobalKey<FormState>();
  final _nome = TextEditingController();
  final _email = TextEditingController();
  final _telefone = TextEditingController();
  final _senha = TextEditingController();
  final _confirmacao = TextEditingController();
  bool _enviando = false;
  bool _senhaVisivel = false;

  @override
  void dispose() {
    for (final controlador in [_nome, _email, _telefone, _senha, _confirmacao]) {
      controlador.dispose();
    }
    super.dispose();
  }

  Future<void> _cadastrar() async {
    if (!_formulario.currentState!.validate()) return;
    setState(() => _enviando = true);
    final dependencias = Dependencias.de(context);
    try {
      dependencias.usuario = await dependencias.api.cadastrar(
        nome: _nome.text.trim(),
        email: _email.text.trim(),
        telefone: _telefone.text.trim().isEmpty ? null : _telefone.text.trim(),
        senha: _senha.text,
      );
      if (!mounted) return;
      Navigator.of(context).pushAndRemoveUntil(MaterialPageRoute(builder: (_) => const TelaAnimais()), (_) => false);
    } catch (erro) {
      if (mounted) mostrarErro(context, erro);
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Criar conta')),
      body: SafeArea(
        child: Form(
          key: _formulario,
          child: ListView(padding: const EdgeInsets.all(24), children: [
            const Text('Com a conta, você cadastra seus animais ou recebe acesso aos animais de outras pessoas.'),
            const SizedBox(height: 24),
            TextFormField(
              key: const Key('cadastro-nome'),
              controller: _nome,
              maxLength: 120,
              textCapitalization: TextCapitalization.words,
              autofillHints: const [AutofillHints.name],
              decoration: const InputDecoration(labelText: 'Nome *', border: OutlineInputBorder()),
              validator: (v) => (v == null || v.trim().isEmpty) ? 'Informe o nome.' : null,
            ),
            TextFormField(
              key: const Key('cadastro-email'),
              controller: _email,
              maxLength: 160,
              keyboardType: TextInputType.emailAddress,
              autocorrect: false,
              autofillHints: const [AutofillHints.email],
              decoration: const InputDecoration(labelText: 'E-mail *', border: OutlineInputBorder()),
              validator: (v) {
                final texto = (v ?? '').trim();
                if (texto.isEmpty) return 'Informe o e-mail.';
                if (!RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(texto)) return 'Informe um e-mail válido.';
                return null;
              },
            ),
            TextFormField(
              key: const Key('cadastro-telefone'),
              controller: _telefone,
              maxLength: 20,
              keyboardType: TextInputType.phone,
              autofillHints: const [AutofillHints.telephoneNumber],
              decoration: const InputDecoration(labelText: 'Telefone', border: OutlineInputBorder()),
              validator: (v) {
                final texto = (v ?? '').trim();
                if (texto.isNotEmpty && !RegExp(r'^[0-9+()\-\s]+$').hasMatch(texto)) {
                  return 'Use apenas números, espaços, parênteses, hífen ou +.';
                }
                return null;
              },
            ),
            TextFormField(
              key: const Key('cadastro-senha'),
              controller: _senha,
              obscureText: !_senhaVisivel,
              autofillHints: const [AutofillHints.newPassword],
              decoration: InputDecoration(
                labelText: 'Senha *',
                helperText: 'Pelo menos 8 caracteres.',
                border: const OutlineInputBorder(),
                suffixIcon: IconButton(
                  tooltip: _senhaVisivel ? 'Ocultar senha' : 'Mostrar senha',
                  icon: Icon(_senhaVisivel ? Icons.visibility_off : Icons.visibility),
                  onPressed: () => setState(() => _senhaVisivel = !_senhaVisivel),
                ),
              ),
              validator: (v) {
                if (v == null || v.isEmpty) return 'Informe a senha.';
                if (v.length < 8) return 'A senha deve ter pelo menos 8 caracteres.';
                return null;
              },
            ),
            const SizedBox(height: 16),
            TextFormField(
              key: const Key('cadastro-confirmacao'),
              controller: _confirmacao,
              obscureText: !_senhaVisivel,
              decoration: const InputDecoration(labelText: 'Repita a senha *', border: OutlineInputBorder()),
              validator: (v) => v != _senha.text ? 'As senhas não são iguais.' : null,
            ),
            const SizedBox(height: 24),
            FilledButton(
              onPressed: _enviando ? null : _cadastrar,
              style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52)),
              child: _enviando
                  ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Text('Criar conta'),
            ),
          ]),
        ),
      ),
    );
  }
}
