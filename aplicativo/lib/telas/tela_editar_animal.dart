// Edicao e inativacao do cadastro do animal (RF05), pelo proprietario.
// O botao que abre esta tela so aparece para quem pode editar o cadastro;
// a decisao real e do servidor (RNF03). Inativar preserva todo o historico.

import 'package:flutter/material.dart';

import '../componentes/formatacao.dart';
import '../componentes/mensagens.dart';
import '../modelos/entidades.dart';
import '../servicos/dependencias.dart';

class TelaEditarAnimal extends StatefulWidget {
  final Animal animal;
  const TelaEditarAnimal({super.key, required this.animal});

  @override
  State<TelaEditarAnimal> createState() => _TelaEditarAnimalState();
}

class _TelaEditarAnimalState extends State<TelaEditarAnimal> {
  final _formulario = GlobalKey<FormState>();
  late final TextEditingController _nome = TextEditingController(text: widget.animal.nome);
  late final TextEditingController _registro = TextEditingController(text: widget.animal.registroAssociacao ?? '');
  late final TextEditingController _pelagem = TextEditingController(text: widget.animal.pelagem ?? '');
  late String _sexo = widget.animal.sexo;
  late DateTime? _nascimento =
      widget.animal.dataNascimento == null ? null : DateTime.parse(widget.animal.dataNascimento!);
  bool _enviando = false;

  @override
  void dispose() {
    _nome.dispose();
    _registro.dispose();
    _pelagem.dispose();
    super.dispose();
  }

  String? _textoOuNulo(TextEditingController controlador) =>
      controlador.text.trim().isEmpty ? null : controlador.text.trim();

  // Envia so o que mudou; campo opcional esvaziado vai como nulo
  Map<String, dynamic> _alteracoes() {
    final animal = widget.animal;
    final nascimento = _nascimento == null ? null : paraDataIso(_nascimento!);
    return {
      if (_nome.text.trim() != animal.nome) 'nome': _nome.text.trim(),
      if (_textoOuNulo(_registro) != animal.registroAssociacao) 'registroAssociacao': _textoOuNulo(_registro),
      if (_textoOuNulo(_pelagem) != animal.pelagem) 'pelagem': _textoOuNulo(_pelagem),
      if (_sexo != animal.sexo) 'sexo': _sexo,
      if (nascimento != animal.dataNascimento) 'dataNascimento': nascimento,
    };
  }

  Future<void> _enviar(Map<String, dynamic> alteracoes, String mensagem) async {
    setState(() => _enviando = true);
    try {
      final atualizado = await Dependencias.de(context).servico.editarAnimal(widget.animal.id, alteracoes);
      if (!mounted) return;
      mostrarMensagem(context, mensagem);
      Navigator.pop(context, atualizado);
    } catch (erro) {
      if (mounted) mostrarErro(context, erro);
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  Future<void> _salvar() async {
    if (!_formulario.currentState!.validate()) return;
    final alteracoes = _alteracoes();
    if (alteracoes.isEmpty) {
      Navigator.pop(context);
      return;
    }
    await _enviar(alteracoes, 'Cadastro atualizado.');
  }

  Future<void> _alternarSituacao() async {
    final inativar = widget.animal.ativo;
    final seguir = await confirmar(
      context,
      titulo: inativar ? 'Inativar cadastro' : 'Reativar cadastro',
      texto: inativar
          ? 'O cadastro de ${widget.animal.nome} fica marcado como inativo. Todo o histórico é preservado e pode ser reativado depois.'
          : 'O cadastro de ${widget.animal.nome} volta a ficar ativo.',
      acao: inativar ? 'Inativar' : 'Reativar',
    );
    if (!seguir || !mounted) return;
    await _enviar({'ativo': !inativar}, inativar ? 'Cadastro inativado.' : 'Cadastro reativado.');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Editar · ${widget.animal.nome}')),
      body: Form(
        key: _formulario,
        child: ListView(padding: const EdgeInsets.all(16), children: [
          TextFormField(
            key: const Key('animal-nome'),
            controller: _nome,
            maxLength: 120,
            decoration: const InputDecoration(labelText: 'Nome *', border: OutlineInputBorder()),
            validator: (v) => (v == null || v.trim().isEmpty) ? 'Informe o nome.' : null,
          ),
          DropdownButtonFormField<String>(
            initialValue: _sexo,
            decoration: const InputDecoration(labelText: 'Sexo *', border: OutlineInputBorder()),
            items: const [
              DropdownMenuItem(value: 'M', child: Text('Macho')),
              DropdownMenuItem(value: 'F', child: Text('Fêmea')),
              DropdownMenuItem(value: 'C', child: Text('Macho castrado')),
            ],
            onChanged: (v) => setState(() => _sexo = v!),
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: _registro,
            maxLength: 40,
            decoration: const InputDecoration(labelText: 'Registro na associação', border: OutlineInputBorder()),
          ),
          TextFormField(
            controller: _pelagem,
            maxLength: 60,
            decoration: const InputDecoration(labelText: 'Pelagem', border: OutlineInputBorder()),
          ),
          Row(children: [
            Expanded(
              child: OutlinedButton.icon(
                icon: const Icon(Icons.cake_outlined),
                label: Text(_nascimento == null ? 'Data de nascimento' : 'Nascimento: ${exibirData(_nascimento!)}'),
                onPressed: () async {
                  final escolhida = await showDatePicker(
                    context: context,
                    firstDate: DateTime(1990),
                    lastDate: DateTime.now(),
                    initialDate: _nascimento ?? DateTime.now(),
                  );
                  if (escolhida != null) setState(() => _nascimento = escolhida);
                },
              ),
            ),
            if (_nascimento != null)
              IconButton(
                tooltip: 'Remover data de nascimento',
                icon: const Icon(Icons.clear),
                onPressed: () => setState(() => _nascimento = null),
              ),
          ]),
          const SizedBox(height: 24),
          FilledButton(
            onPressed: _enviando ? null : _salvar,
            style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
            child: const Text('Salvar alterações'),
          ),
          const SizedBox(height: 32),
          const Divider(),
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: Icon(widget.animal.ativo ? Icons.archive_outlined : Icons.unarchive_outlined),
            title: Text(widget.animal.ativo ? 'Inativar cadastro' : 'Reativar cadastro'),
            subtitle: Text(widget.animal.ativo
                ? 'Use quando o animal deixar de ser acompanhado. O histórico é preservado.'
                : 'Este cadastro está inativo.'),
            onTap: _enviando ? null : _alternarSituacao,
          ),
        ]),
      ),
    );
  }
}
