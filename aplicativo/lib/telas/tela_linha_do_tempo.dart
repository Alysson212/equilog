// Linha do tempo do animal (RF13, RF14; UC08). Consome GET /animais/{id}/eventos
// com paginacao e filtros de dominio, periodo e autor. O servidor ja devolve
// apenas os dominios que o papel pode ler; os filtros de dominio oferecidos
// aqui sao os mesmos, por conveniencia visual.
// Registros gravados no aparelho e ainda nao confirmados aparecem no topo,
// com a indicacao da situacao de envio.

import 'dart:async';

import 'package:flutter/material.dart';

import '../componentes/cartao_evento.dart';
import '../componentes/formatacao.dart';
import '../componentes/mensagens.dart';
import '../modelos/entidades.dart';
import '../modelos/permissoes.dart';
import '../servicos/dependencias.dart';
import '../servicos/equilog_servico.dart';
import 'tela_acessos.dart';
import 'tela_registro_evento.dart';

class TelaLinhaDoTempo extends StatefulWidget {
  final Animal animal;
  const TelaLinhaDoTempo({super.key, required this.animal});

  @override
  State<TelaLinhaDoTempo> createState() => _TelaLinhaDoTempoState();
}

class _TelaLinhaDoTempoState extends State<TelaLinhaDoTempo> {
  static const _tamanhoPagina = 20;

  final _rolagem = ScrollController();
  final List<ItemLinhaDoTempo> _itens = [];
  List<ItemLinhaDoTempo> _locais = [];
  final Map<String, String> _autoresConhecidos = {};
  int _total = 0;
  bool _carregando = false;
  bool _iniciado = false;
  Object? _erro;
  String? _dominio;
  DateTimeRange? _periodo;
  String? _autorId;
  StreamSubscription<void>? _alteracoes;

  Animal get animal => widget.animal;

  @override
  void initState() {
    super.initState();
    _rolagem.addListener(() {
      if (_rolagem.position.pixels > _rolagem.position.maxScrollExtent - 300) _carregarMais();
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_iniciado) {
      _iniciado = true;
      _alteracoes = Dependencias.de(context).fila.alteracoes.listen((_) => _recarregar());
      _recarregar();
    }
  }

  @override
  void dispose() {
    _alteracoes?.cancel();
    _rolagem.dispose();
    super.dispose();
  }

  FiltrosLinhaDoTempo get _filtros => FiltrosLinhaDoTempo(
        dominio: _dominio,
        de: _periodo == null ? null : paraDataIso(_periodo!.start),
        ate: _periodo == null ? null : paraDataIso(_periodo!.end),
        autorId: _autorId,
      );

  Future<void> _recarregar() async {
    _itens.clear();
    _total = 0;
    _erro = null;
    await _carregarLocais();
    await _carregarMais(primeira: true);
  }

  // Registros da fila local deste animal que ainda nao foram confirmados
  Future<void> _carregarLocais() async {
    final dependencias = Dependencias.de(context);
    final locais = await dependencias.base.naoSincronizadosDoAnimal(dependencias.usuario!.id, animal.id);
    final usuario = dependencias.usuario!;
    final itens = locais
        .where((e) => _dominio == null || e.dominio == _dominio)
        .map((e) => ItemLinhaDoTempo(
              id: e.id,
              dominio: e.dominio,
              tipoEvento: e.corpo['tipoEvento'] as String,
              dataEvento: e.dataEvento,
              titulo: e.corpo['titulo'] as String,
              observacao: e.corpo['observacao'] as String?,
              autorId: usuario.id,
              autorNome: usuario.nome,
              versao: e.versao,
              detalhe: Map<String, dynamic>.from((e.corpo['detalhe'] ?? {}) as Map),
              situacaoLocal: e.estado.name,
            ))
        .toList();
    if (mounted) setState(() => _locais = itens);
  }

  Future<void> _carregarMais({bool primeira = false}) async {
    if (_carregando || (!primeira && _itens.length >= _total)) return;
    setState(() => _carregando = true);
    try {
      final pagina = await Dependencias.de(context).servico.linhaDoTempo(
            animal.id,
            filtros: _filtros,
            limite: _tamanhoPagina,
            deslocamento: _itens.length,
          );
      if (!mounted) return;
      setState(() {
        final idsLocais = _locais.map((l) => l.id).toSet();
        _itens.addAll(pagina.itens.where((i) => !idsLocais.contains(i.id)));
        _total = pagina.total;
        for (final item in pagina.itens) {
          _autoresConhecidos[item.autorId] = item.autorNome;
        }
      });
    } catch (erro) {
      if (mounted) setState(() => _erro = erro);
    } finally {
      if (mounted) setState(() => _carregando = false);
    }
  }

  Future<void> _escolherPeriodo() async {
    final agora = DateTime.now();
    final escolhido = await showDateRangePicker(
      context: context,
      firstDate: DateTime(2000),
      lastDate: DateTime(agora.year + 1, 12, 31),
      initialDateRange: _periodo,
      helpText: 'Período',
    );
    if (escolhido != null) {
      setState(() => _periodo = escolhido);
      await _recarregar();
    }
  }

  Future<void> _novoRegistro() async {
    final salvo = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => TelaRegistroEvento(animal: animal)),
    );
    if (salvo == true) await _recarregar();
  }

  @override
  Widget build(BuildContext context) {
    final legiveis = dominiosLegiveis(animal.papel);
    final podeRegistrar = dominiosRegistraveis(animal.papel).isNotEmpty;
    final ehProprietario = papelPode(animal.papel, Acao.ler, 'acesso');

    return Scaffold(
      appBar: AppBar(
        title: Text(animal.nome),
        actions: [
          if (ehProprietario)
            IconButton(
              tooltip: 'Acessos',
              icon: const Icon(Icons.group_outlined),
              onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => TelaAcessos(animal: animal))),
            ),
        ],
      ),
      floatingActionButton: podeRegistrar
          ? FloatingActionButton.extended(onPressed: _novoRegistro, icon: const Icon(Icons.add), label: const Text('Novo registro'))
          : null,
      body: Column(children: [
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
          child: Row(children: [
            ChoiceChip(
              label: const Text('Todos'),
              selected: _dominio == null,
              onSelected: (_) {
                setState(() => _dominio = null);
                _recarregar();
              },
            ),
            for (final dominio in legiveis)
              Padding(
                padding: const EdgeInsets.only(left: 6),
                child: ChoiceChip(
                  avatar: Icon(iconesDominio[dominio], size: 18),
                  label: Text(nomesDominio[dominio]!),
                  selected: _dominio == dominio,
                  onSelected: (_) {
                    setState(() => _dominio = dominio);
                    _recarregar();
                  },
                ),
              ),
          ]),
        ),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          child: Row(children: [
            InputChip(
              avatar: const Icon(Icons.date_range, size: 18),
              label: Text(_periodo == null
                  ? 'Período'
                  : '${exibirData(_periodo!.start)} a ${exibirData(_periodo!.end)}'),
              onPressed: _escolherPeriodo,
              onDeleted: _periodo == null
                  ? null
                  : () {
                      setState(() => _periodo = null);
                      _recarregar();
                    },
            ),
            const SizedBox(width: 6),
            PopupMenuButton<String?>(
              tooltip: 'Filtrar por autor',
              onSelected: (id) {
                setState(() => _autorId = id);
                _recarregar();
              },
              itemBuilder: (_) => [
                const PopupMenuItem(value: null, child: Text('Todos os autores')),
                for (final autor in _autoresConhecidos.entries) PopupMenuItem(value: autor.key, child: Text(autor.value)),
              ],
              child: Chip(
                avatar: const Icon(Icons.person_outline, size: 18),
                label: Text(_autorId == null ? 'Autor' : 'Autor: ${_autoresConhecidos[_autorId]}'),
              ),
            ),
          ]),
        ),
        Expanded(child: _lista()),
      ]),
    );
  }

  Widget _lista() {
    final todos = [..._locais, ..._itens];
    if (todos.isEmpty) {
      if (_carregando) return const Center(child: CircularProgressIndicator());
      if (_erro != null) return AvisoVazio(icone: Icons.cloud_off, texto: textoDoErro(_erro!));
      return const AvisoVazio(icone: Icons.history, texto: 'Nenhum registro encontrado.');
    }
    return RefreshIndicator(
      onRefresh: () async {
        await Dependencias.de(context).sincronizar();
        await _recarregar();
      },
      child: ListView.builder(
        controller: _rolagem,
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.only(bottom: 96),
        itemCount: todos.length + 1,
        itemBuilder: (context, indice) {
          if (indice < todos.length) return CartaoEvento(item: todos[indice]);
          if (_carregando) return const Padding(padding: EdgeInsets.all(16), child: Center(child: CircularProgressIndicator()));
          if (_erro != null) {
            return Padding(
              padding: const EdgeInsets.all(16),
              child: Text(textoDoErro(_erro!), textAlign: TextAlign.center),
            );
          }
          return Padding(
            padding: const EdgeInsets.all(16),
            child: Text('${_itens.length} de $_total registros', textAlign: TextAlign.center, style: Theme.of(context).textTheme.bodySmall),
          );
        },
      ),
    );
  }
}
