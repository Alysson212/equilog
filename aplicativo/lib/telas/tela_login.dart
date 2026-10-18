// Tela de autenticacao (RF02). Login invalido mostra a mensagem do servidor,
// que nao revela qual campo esta errado.

import 'package:flutter/material.dart';

import '../componentes/mensagens.dart';
import '../servicos/dependencias.dart';
import 'tela_animais.dart';
import 'tela_cadastro.dart';

class TelaLogin extends StatefulWidget {
  const TelaLogin({super.key});

  @override
  State<TelaLogin> createState() => _TelaLoginState();
}

class _TelaLoginState extends State<TelaLogin> {
  final _formulario = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _senha = TextEditingController();
  bool _enviando = false;
  bool _senhaVisivel = false;

  Future<void> _entrar() async {
    if (!_formulario.currentState!.validate()) return;
    setState(() => _enviando = true);
    final dependencias = Dependencias.de(context);
    try {
      dependencias.usuario = await dependencias.api.entrar(_email.text.trim(), _senha.text);
      if (!mounted) return;
      Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => const TelaAnimais()));
      dependencias.sincronizar();
    } catch (erro) {
      if (mounted) mostrarErro(context, erro);
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Form(
              key: _formulario,
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Icon(Icons.pets, size: 56, color: tema.colorScheme.primary),
                const SizedBox(height: 8),
                Text('EquiLog', textAlign: TextAlign.center, style: tema.textTheme.headlineMedium),
                Text('Registro integrado do seu animal', textAlign: TextAlign.center, style: tema.textTheme.bodyMedium),
                const SizedBox(height: 32),
                TextFormField(
                  key: const Key('campo-email'),
                  controller: _email,
                  keyboardType: TextInputType.emailAddress,
                  autofillHints: const [AutofillHints.email],
                  decoration: const InputDecoration(labelText: 'E-mail', border: OutlineInputBorder()),
                  validator: (v) => (v == null || v.trim().isEmpty) ? 'Informe o e-mail.' : null,
                ),
                const SizedBox(height: 16),
                TextFormField(
                  key: const Key('campo-senha'),
                  controller: _senha,
                  obscureText: !_senhaVisivel,
                  autofillHints: const [AutofillHints.password],
                  decoration: InputDecoration(
                    labelText: 'Senha',
                    border: const OutlineInputBorder(),
                    suffixIcon: IconButton(
                      tooltip: _senhaVisivel ? 'Ocultar senha' : 'Mostrar senha',
                      icon: Icon(_senhaVisivel ? Icons.visibility_off : Icons.visibility),
                      onPressed: () => setState(() => _senhaVisivel = !_senhaVisivel),
                    ),
                  ),
                  validator: (v) => (v == null || v.isEmpty) ? 'Informe a senha.' : null,
                  onFieldSubmitted: (_) => _entrar(),
                ),
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: _enviando ? null : _entrar,
                  style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52)),
                  child: _enviando
                      ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Text('Entrar'),
                ),
                const SizedBox(height: 12),
                TextButton(
                  onPressed: _enviando
                      ? null
                      : () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const TelaCadastro())),
                  child: const Text('Não tem conta? Criar conta'),
                ),
              ]),
            ),
          ),
        ),
      ),
    );
  }
}
