// Concessao e revogacao de acesso (RF06, RF07; UC03). Restrita ao proprietario:
// o botao de acesso so aparece para esse papel, e o servidor recusa os demais.

import 'package:flutter/material.dart';

import '../componentes/formatacao.dart';
import '../componentes/mensagens.dart';
import '../modelos/entidades.dart';
import '../modelos/permissoes.dart';
import '../servicos/dependencias.dart';

class TelaAcessos extends StatefulWidget {
  final Animal animal;
  const TelaAcessos({super.key, required this.animal});

  @override
  State<TelaAcessos> createState() => _TelaAcessosState();
}

class _TelaAcessosState extends State<TelaAcessos> {
  List<Vinculo>? _vinculos;
  Object? _erro;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_vinculos == null && _erro == null) _carregar();
  }

  Future<void> _carregar() async {
    try {
      final vinculos = await Dependencias.de(context).servico.listarAcessos(widget.animal.id);
      if (mounted) setState(() => (_vinculos = vinculos, _erro = null));
    } catch (erro) {
      if (mounted) setState(() => _erro = erro);
    }
  }

  Future<void> _revogar(Vinculo vinculo) async {
    final seguir = await confirmar(
      context,
      titulo: 'Revogar acesso',
      texto: '${vinculo.usuarioNome} deixará de acessar ${widget.animal.nome} imediatamente.',
      acao: 'Revogar',
    );
    if (!seguir || !mounted) return;
    try {
      await Dependencias.de(context).servico.revogarAcesso(vinculo.id);
      if (!mounted) return;
      mostrarMensagem(context, 'Acesso revogado.');
      await _carregar();
    } catch (erro) {
      if (mounted) mostrarErro(context, erro);
    }
  }

  Future<void> _conceder() async {
    final concedido = await showModalBottomSheet<Vinculo>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _FormularioConcessao(animal: widget.animal),
    );
    if (concedido != null && mounted) {
      mostrarMensagem(context, 'Acesso concedido a ${concedido.usuarioNome}.');
      await _carregar();
    }
  }

  @override
  Widget build(BuildContext context) {
    final vinculos = _vinculos;
    return Scaffold(
      appBar: AppBar(title: Text('Acessos · ${widget.animal.nome}')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _conceder,
        icon: const Icon(Icons.person_add_alt),
        label: const Text('Conceder acesso'),
      ),
      body: vinculos == null
          ? (_erro != null
              ? AvisoVazio(icone: Icons.cloud_off, texto: textoDoErro(_erro!))
              : const Center(child: CircularProgressIndicator()))
          : RefreshIndicator(
              onRefresh: _carregar,
              child: ListView(padding: const EdgeInsets.only(bottom: 96), children: [
                for (final vinculo in vinculos)
                  ListTile(
                    leading: Icon(vinculo.vigente ? Icons.verified_user_outlined : Icons.person_off_outlined),
                    title: Text(vinculo.usuarioNome),
                    subtitle: Text([
                      nomesPapel[vinculo.papel]!,
                      'desde ${exibirDataIso(vinculo.dataInicio)}',
                      vinculo.dataFim == null ? 'sem data de fim' : 'até ${exibirDataIso(vinculo.dataFim!)}',
                      if (!vinculo.ativo) 'revogado' else if (!vinculo.vigente) 'fora da vigência',
                    ].join(' · ')),
                    trailing: vinculo.ativo && vinculo.papel != 'proprietario'
                        ? IconButton(tooltip: 'Revogar', icon: const Icon(Icons.block), onPressed: () => _revogar(vinculo))
                        : null,
                  ),
              ]),
            ),
    );
  }
}

class _FormularioConcessao extends StatefulWidget {
  final Animal animal;
  const _FormularioConcessao({required this.animal});

  @override
  State<_FormularioConcessao> createState() => _FormularioConcessaoState();
}

class _FormularioConcessaoState extends State<_FormularioConcessao> {
  final _formulario = GlobalKey<FormState>();
  final _email = TextEditingController();
  String? _papel;
  DateTime _inicio = DateTime.now();
  DateTime? _fim;
  bool _enviando = false;

  Future<void> _salvar() async {
    if (!_formulario.currentState!.validate()) return;
    setState(() => _enviando = true);
    try {
      final vinculo = await Dependencias.de(context).servico.concederAcesso(
            widget.animal.id,
            email: _email.text.trim(),
            papel: _papel!,
            dataInicio: paraDataIso(_inicio),
            dataFim: _fim == null ? null : paraDataIso(_fim!),
          );
      if (mounted) Navigator.pop(context, vinculo);
    } catch (erro) {
      if (mounted) mostrarErro(context, erro);
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  Future<DateTime?> _escolherData(DateTime? atual, {DateTime? minimo}) => showDatePicker(
        context: context,
        firstDate: minimo ?? DateTime(2000),
        lastDate: DateTime(DateTime.now().year + 5, 12, 31),
        initialDate: atual ?? minimo ?? DateTime.now(),
      );

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 16, 16, MediaQuery.of(context).viewInsets.bottom + 16),
      child: Form(
        key: _formulario,
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text('Conceder acesso', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 4),
          const Text('A pessoa precisa já ter uma conta no EquiLog.'),
          const SizedBox(height: 16),
          TextFormField(
            controller: _email,
            keyboardType: TextInputType.emailAddress,
            decoration: const InputDecoration(labelText: 'E-mail da pessoa *', border: OutlineInputBorder()),
            validator: (v) => (v == null || v.trim().isEmpty) ? 'Informe o e-mail.' : null,
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: _papel,
            decoration: const InputDecoration(labelText: 'Papel *', border: OutlineInputBorder()),
            items: [
              for (final papel in ['veterinario', 'treinador', 'manejo'])
                DropdownMenuItem(value: papel, child: Text(nomesPapel[papel]!)),
            ],
            onChanged: (v) => setState(() => _papel = v),
            validator: (v) => v == null ? 'Escolha o papel.' : null,
          ),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(
              child: OutlinedButton(
                onPressed: () async {
                  final data = await _escolherData(_inicio);
                  if (data != null) setState(() => _inicio = data);
                },
                child: Text('Início: ${exibirData(_inicio)}'),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: OutlinedButton(
                onPressed: () async {
                  final data = await _escolherData(_fim, minimo: _inicio);
                  setState(() => _fim = data);
                },
                child: Text(_fim == null ? 'Fim: sem data' : 'Fim: ${exibirData(_fim!)}'),
              ),
            ),
          ]),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _enviando ? null : _salvar,
            style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
            child: const Text('Conceder'),
          ),
        ]),
      ),
    );
  }
}
