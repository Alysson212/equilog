// Lista dos animais com vinculo vigente (RF08), com o papel do usuario em cada
// um, e cadastro de novo animal (RF04). Sem conexao, mostra a ultima lista
// conhecida, para que o registro de eventos continue possivel (RF21).

import 'dart:async';

import 'package:flutter/material.dart';

import '../componentes/formatacao.dart';
import '../componentes/mensagens.dart';
import '../modelos/entidades.dart';
import '../modelos/permissoes.dart';
import '../servicos/dependencias.dart';
import '../sincronizacao/base_local.dart';
import 'tela_lembretes.dart';
import 'tela_linha_do_tempo.dart';
import 'tela_login.dart';

class TelaAnimais extends StatefulWidget {
  const TelaAnimais({super.key});

  @override
  State<TelaAnimais> createState() => _TelaAnimaisState();
}

class _TelaAnimaisState extends State<TelaAnimais> {
  List<Animal>? _animais;
  bool _semConexao = false;
  Object? _erro;
  int _pendentes = 0;
  StreamSubscription<void>? _alteracoes;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_animais == null && _erro == null) {
      _carregar();
      _alteracoes ??= Dependencias.de(context).fila.alteracoes.listen((_) => _contarPendentes());
    }
  }

  @override
  void dispose() {
    _alteracoes?.cancel();
    super.dispose();
  }

  Future<void> _carregar() async {
    final dependencias = Dependencias.de(context);
    try {
      final (animais, doCache) = await dependencias.animais();
      if (!mounted) return;
      setState(() {
        _animais = animais;
        _semConexao = doCache;
        _erro = null;
      });
    } catch (erro) {
      if (mounted) setState(() => _erro = erro);
    }
    await _contarPendentes();
  }

  Future<void> _contarPendentes() async {
    final dependencias = Dependencias.de(context);
    final total = await dependencias.base.contarPorEstado(dependencias.usuario!.id, EstadoSync.pendente);
    if (mounted) setState(() => _pendentes = total);
  }

  Future<void> _sincronizarAgora() async {
    final resultado = await Dependencias.de(context).sincronizar();
    if (!mounted) return;
    if (resultado == null || resultado.interrompidoSemConexao) {
      mostrarMensagem(context, 'Sem conexão. Os registros continuam guardados no aparelho.');
    } else {
      mostrarMensagem(context, 'Registros enviados: ${resultado.sincronizados}.');
    }
    await _carregar();
  }

  Future<void> _sair() async {
    final dependencias = Dependencias.de(context);
    if (_pendentes > 0) {
      final seguir = await confirmar(context,
          titulo: 'Há registros não enviados',
          texto: 'Eles continuam guardados no aparelho e serão enviados no próximo acesso com esta conta.',
          acao: 'Sair mesmo assim');
      if (!seguir) return;
    }
    await dependencias.api.sair();
    dependencias.usuario = null;
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(MaterialPageRoute(builder: (_) => const TelaLogin()), (_) => false);
  }

  Future<void> _cadastrar() async {
    final criado = await showModalBottomSheet<Animal>(
      context: context,
      isScrollControlled: true,
      builder: (_) => const _FormularioAnimal(),
    );
    if (criado != null && mounted) {
      mostrarMensagem(context, '${criado.nome} cadastrado.');
      await _carregar();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Meus animais'),
        actions: [
          IconButton(
            tooltip: 'Lembretes',
            icon: const Icon(Icons.notifications_outlined),
            onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const TelaLembretes())),
          ),
          IconButton(
            tooltip: _pendentes > 0 ? '$_pendentes registros aguardando envio' : 'Sincronizar',
            icon: Badge(
              isLabelVisible: _pendentes > 0,
              label: Text('$_pendentes'),
              child: const Icon(Icons.sync),
            ),
            onPressed: _sincronizarAgora,
          ),
          IconButton(tooltip: 'Sair', icon: const Icon(Icons.logout), onPressed: _sair),
        ],
      ),
      floatingActionButton: _semConexao
          ? null
          : FloatingActionButton.extended(
              onPressed: _cadastrar,
              icon: const Icon(Icons.add),
              label: const Text('Cadastrar animal'),
            ),
      body: _corpo(),
    );
  }

  Widget _corpo() {
    if (_erro != null && _animais == null) {
      return AvisoVazio(icone: Icons.cloud_off, texto: '${textoDoErro(_erro!)}\nPuxe para baixo para tentar de novo.');
    }
    final animais = _animais;
    if (animais == null) return const Center(child: CircularProgressIndicator());
    return RefreshIndicator(
      onRefresh: _carregar,
      child: ListView(
        padding: const EdgeInsets.only(bottom: 96),
        children: [
          if (_semConexao)
            const MaterialBanner(
              content: Text('Sem conexão. Mostrando a última lista conhecida; os registros ficam guardados no aparelho.'),
              leading: Icon(Icons.cloud_off),
              actions: [SizedBox.shrink()],
            ),
          if (animais.isEmpty)
            const AvisoVazio(icone: Icons.pets, texto: 'Nenhum animal ainda. Cadastre o seu ou peça acesso ao proprietário.'),
          for (final animal in animais)
            ListTile(
              leading: CircleAvatar(child: Text(animal.nome.characters.first.toUpperCase())),
              title: Text(animal.nome),
              subtitle: Text([
                nomesPapel[animal.papel]!,
                if (animal.pelagem != null) animal.pelagem!,
                if (!animal.ativo) 'cadastro inativo',
              ].join(' · ')),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => Navigator.of(context)
                  .push(MaterialPageRoute(builder: (_) => TelaLinhaDoTempo(animal: animal)))
                  .then((_) => _carregar()),
            ),
        ],
      ),
    );
  }
}

class _FormularioAnimal extends StatefulWidget {
  const _FormularioAnimal();

  @override
  State<_FormularioAnimal> createState() => _FormularioAnimalState();
}

class _FormularioAnimalState extends State<_FormularioAnimal> {
  final _formulario = GlobalKey<FormState>();
  final _nome = TextEditingController();
  final _registro = TextEditingController();
  final _pelagem = TextEditingController();
  String? _sexo;
  DateTime? _nascimento;
  bool _enviando = false;

  Future<void> _salvar() async {
    if (!_formulario.currentState!.validate()) return;
    setState(() => _enviando = true);
    try {
      final animal = await Dependencias.de(context).servico.cadastrarAnimal({
        'nome': _nome.text.trim(),
        'sexo': _sexo,
        if (_registro.text.trim().isNotEmpty) 'registroAssociacao': _registro.text.trim(),
        if (_pelagem.text.trim().isNotEmpty) 'pelagem': _pelagem.text.trim(),
        if (_nascimento != null) 'dataNascimento': paraDataIso(_nascimento!),
      });
      if (mounted) Navigator.pop(context, animal);
    } catch (erro) {
      if (mounted) mostrarErro(context, erro);
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 16, 16, MediaQuery.of(context).viewInsets.bottom + 16),
      child: Form(
        key: _formulario,
        child: SingleChildScrollView(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
            Text('Cadastrar animal', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 16),
            TextFormField(
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
              onChanged: (v) => setState(() => _sexo = v),
              validator: (v) => v == null ? 'Escolha o sexo.' : null,
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
            OutlinedButton.icon(
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
            const SizedBox(height: 16),
            FilledButton(
              onPressed: _enviando ? null : _salvar,
              style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
              child: const Text('Salvar'),
            ),
          ]),
        ),
      ),
    );
  }
}
