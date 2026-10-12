// Lembretes do usuario (RF18, RF19). A lista ja vem filtrada pelo servidor: o
// lembrete so aparece para quem le o dominio do evento de origem. Ao marcar
// cumprido, adiado ou cancelado, a notificacao local e cancelada ou
// reagendada de imediato (CT15). A nova data, ao adiar, e escolhida pela
// pessoa; nada e sugerido (RNF11).

import 'package:flutter/material.dart';

import '../componentes/formatacao.dart';
import '../componentes/mensagens.dart';
import '../modelos/entidades.dart';
import '../modelos/formularios_evento.dart';
import '../modelos/permissoes.dart';
import '../servicos/dependencias.dart';

class TelaLembretes extends StatefulWidget {
  const TelaLembretes({super.key});

  @override
  State<TelaLembretes> createState() => _TelaLembretesState();
}

class _TelaLembretesState extends State<TelaLembretes> {
  List<Lembrete>? _lembretes;
  Object? _erro;
  bool _somenteEmAberto = true;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_lembretes == null && _erro == null) _carregar();
  }

  Future<void> _carregar() async {
    final dependencias = Dependencias.de(context);
    try {
      final lembretes = await dependencias.servico.listarLembretes();
      await dependencias.notificacoes.sincronizarAgendamentos(lembretes);
      if (mounted) setState(() => (_lembretes = lembretes, _erro = null));
    } catch (erro) {
      if (mounted) setState(() => _erro = erro);
    }
  }

  Future<void> _alterar(Lembrete lembrete, String status) async {
    final dependencias = Dependencias.de(context);
    String? novaData;
    if (status == 'adiado') {
      final data = await showDatePicker(
        context: context,
        firstDate: DateTime.now(),
        lastDate: DateTime(DateTime.now().year + 5, 12, 31),
        helpText: 'Adiar para',
      );
      if (data == null) return;
      novaData = paraDataIso(data);
    }
    try {
      final alterado = await dependencias.servico.alterarLembrete(lembrete.id, status, novaData: novaData);
      // cancela ou reagenda a notificacao no aparelho conforme o novo estado
      await dependencias.notificacoes.sincronizarAgendamentos([alterado]);
      if (!mounted) return;
      mostrarMensagem(context, switch (status) {
        'cumprido' => 'Lembrete marcado como cumprido.',
        'adiado' => 'Lembrete adiado para ${exibirDataIso(novaData!)}.',
        _ => 'Lembrete cancelado.',
      });
      await _carregar();
    } catch (erro) {
      if (mounted) mostrarErro(context, erro);
    }
  }

  @override
  Widget build(BuildContext context) {
    final todos = _lembretes;
    final lembretes = todos?.where((l) => !_somenteEmAberto || l.emAberto).toList();
    return Scaffold(
      appBar: AppBar(
        title: const Text('Lembretes'),
        actions: [
          FilterChip(
            label: const Text('Só em aberto'),
            selected: _somenteEmAberto,
            onSelected: (v) => setState(() => _somenteEmAberto = v),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: lembretes == null
          ? (_erro != null
              ? AvisoVazio(icone: Icons.cloud_off, texto: textoDoErro(_erro!))
              : const Center(child: CircularProgressIndicator()))
          : RefreshIndicator(
              onRefresh: _carregar,
              child: lembretes.isEmpty
                  ? ListView(children: const [AvisoVazio(icone: Icons.notifications_none, texto: 'Nenhum lembrete.')])
                  : ListView(children: [
                      for (final lembrete in lembretes)
                        ListTile(
                          leading: Icon(lembrete.emAberto ? Icons.event_note : Icons.event_available),
                          title: Text('${lembrete.animalNome} · ${exibirDataIso(lembrete.dataPrevista)}'),
                          subtitle: Text([
                            if (lembrete.eventoTitulo != null) lembrete.eventoTitulo!,
                            if (lembrete.tipoEvento != null) nomesTipo[lembrete.tipoEvento] ?? lembrete.tipoEvento!,
                            switch (lembrete.status) {
                              'pendente' => 'pendente',
                              'adiado' => 'adiado',
                              'cumprido' => 'cumprido',
                              _ => 'cancelado',
                            },
                          ].join(' · ')),
                          trailing: lembrete.emAberto && papelPode(lembrete.papel, Acao.editar, 'lembrete')
                              ? PopupMenuButton<String>(
                                  tooltip: 'Alterar situação',
                                  onSelected: (status) => _alterar(lembrete, status),
                                  itemBuilder: (_) => const [
                                    PopupMenuItem(value: 'cumprido', child: Text('Marcar como cumprido')),
                                    PopupMenuItem(value: 'adiado', child: Text('Adiar')),
                                    PopupMenuItem(value: 'cancelado', child: Text('Cancelar')),
                                  ],
                                )
                              : null,
                        ),
                    ]),
            ),
    );
  }
}
