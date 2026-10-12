// Item da linha do tempo: dominio, data, titulo, autor e situacao local.

import 'package:flutter/material.dart';

import '../modelos/entidades.dart';
import '../modelos/formularios_evento.dart';
import '../modelos/permissoes.dart';
import 'formatacao.dart';

const iconesDominio = {
  'saude': Icons.medical_services_outlined,
  'manejo': Icons.grass_outlined,
  'treinamento': Icons.directions_run,
  'competicao': Icons.emoji_events_outlined,
};

const coresDominio = {
  'saude': Color(0xFF2E7D6B),
  'manejo': Color(0xFF8A6D3B),
  'treinamento': Color(0xFF3F5FA8),
  'competicao': Color(0xFFA8473F),
};

const _rotulosDetalhe = {
  'procedimento': 'Procedimento',
  'produto': 'Produto',
  'dose': 'Dose',
  'via': 'Via',
  'profissional': 'Profissional',
  'dataRetorno': 'Retorno',
  'categoria': 'Categoria',
  'descricao': 'Descrição',
  'quantidade': 'Quantidade',
  'unidade': 'Unidade',
  'tipoExercicio': 'Exercício',
  'duracaoMin': 'Duração (min)',
  'intensidade': 'Intensidade',
  'piso': 'Piso',
  'nomeProva': 'Prova',
  'local': 'Local',
  'tempoSegundos': 'Tempo (s)',
  'colocacao': 'Colocação',
  'penalidade': 'Penalidade',
};

// Datas em dd/mm/aaaa e decimais com virgula
String _valor(String campo, Object? valor) {
  if (campo == 'dataRetorno') return exibirDataIso(valor as String);
  if (valor is double) return valor.toString().replaceAll('.', ',');
  return '$valor';
}

class CartaoEvento extends StatelessWidget {
  final ItemLinhaDoTempo item;
  const CartaoEvento({super.key, required this.item});

  @override
  Widget build(BuildContext context) {
    final cor = coresDominio[item.dominio]!;
    final detalhes = item.detalhe.entries
        .where((e) => e.value != null && e.value.toString().isNotEmpty)
        .map((e) => '${_rotulosDetalhe[e.key] ?? e.key}: ${_valor(e.key, e.value)}')
        .join('  ·  ');

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          CircleAvatar(backgroundColor: cor.withValues(alpha: 0.12), child: Icon(iconesDominio[item.dominio], color: cor)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Text(nomesDominio[item.dominio]!, style: TextStyle(color: cor, fontWeight: FontWeight.w600, fontSize: 12)),
                const Spacer(),
                Text(exibirDataHora(item.dataEvento), style: Theme.of(context).textTheme.bodySmall),
              ]),
              const SizedBox(height: 2),
              Text(item.titulo, style: Theme.of(context).textTheme.titleMedium),
              Text('${nomesTipo[item.tipoEvento] ?? item.tipoEvento} · por ${item.autorNome}',
                  style: Theme.of(context).textTheme.bodySmall),
              if (detalhes.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 4), child: Text(detalhes)),
              if (item.observacao != null && item.observacao!.isNotEmpty)
                Padding(padding: const EdgeInsets.only(top: 4), child: Text(item.observacao!, style: const TextStyle(fontStyle: FontStyle.italic))),
              if (item.situacaoLocal != null) Padding(padding: const EdgeInsets.only(top: 6), child: SeloSincronizacao(situacao: item.situacaoLocal!)),
            ]),
          ),
        ]),
      ),
    );
  }
}

// Indicacao do registro ainda nao confirmado pelo servidor (Apendice E, item j)
class SeloSincronizacao extends StatelessWidget {
  final String situacao;
  const SeloSincronizacao({super.key, required this.situacao});

  @override
  Widget build(BuildContext context) {
    final (texto, icone, cor) = switch (situacao) {
      'pendente' => ('Aguardando envio', Icons.cloud_upload_outlined, Colors.orange.shade800),
      'conflito' => ('Alterado por outra pessoa: confira', Icons.sync_problem, Colors.red.shade700),
      'recusado' => ('Não aceito pelo servidor', Icons.block, Colors.red.shade700),
      _ => ('Enviado', Icons.cloud_done_outlined, Colors.green.shade700),
    };
    return Row(mainAxisSize: MainAxisSize.min, children: [
      Icon(icone, size: 16, color: cor),
      const SizedBox(width: 4),
      Text(texto, style: TextStyle(color: cor, fontSize: 12, fontWeight: FontWeight.w600)),
    ]);
  }
}
