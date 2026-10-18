// Registro de evento (RF09 a RF12). O formulario e gerado a partir do dominio
// escolhido. Obrigatorios: tipo, data, titulo e o atributo principal do
// dominio; na saude, a data de retorno quando o tipo a exige (no maximo cinco,
// RNF07). Os demais atributos ficam na secao recolhida "Mais informações".
//
// So aparecem os dominios em que o papel pode registrar; isso e conveniencia
// visual, a decisao real e do servidor (RNF03).
//
// O registro e gravado na base local, com id gerado no aparelho, e depois
// enviado pela fila de sincronizacao (RF21, RNF06).
//
// Com um evento informado, a tela edita esse registro (RF15): o dominio nao
// muda, os campos chegam preenchidos e a alteracao vai direto ao servidor com
// a versao conhecida, para que uma edicao concorrente seja detectada (409).
// A edicao exige conexao; a fila offline guarda apenas registros novos.

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../componentes/cartao_evento.dart';
import '../componentes/formatacao.dart';
import '../componentes/mensagens.dart';
import '../modelos/entidades.dart';
import '../modelos/formularios_evento.dart';
import '../modelos/permissoes.dart';
import '../servicos/api_cliente.dart';
import '../servicos/dependencias.dart';

class TelaRegistroEvento extends StatefulWidget {
  final Animal animal;
  // evento a editar; nulo para um registro novo
  final ItemLinhaDoTempo? evento;
  const TelaRegistroEvento({super.key, required this.animal, this.evento});

  @override
  State<TelaRegistroEvento> createState() => _TelaRegistroEventoState();
}

class _TelaRegistroEventoState extends State<TelaRegistroEvento> {
  final _formulario = GlobalKey<FormState>();
  final _titulo = TextEditingController();
  final _observacao = TextEditingController();
  final Map<String, TextEditingController> _campos = {};
  late final List<String> _dominios;
  late String _dominio;
  TipoEvento? _tipo;
  DateTime _dataEvento = DateTime.now();
  DateTime? _dataRetorno;
  bool _salvando = false;
  // tipos de GET /tipos-evento; ate a resposta, o conjunto de contingencia
  Map<String, List<TipoEvento>> _tipos = tiposDeContingencia;
  OrigemTipos? _origemTipos;

  bool get _editando => widget.evento != null;

  @override
  void initState() {
    super.initState();
    final evento = widget.evento;
    if (evento == null) {
      _dominios = dominiosRegistraveis(widget.animal.papel);
      _dominio = _dominios.first;
      return;
    }
    // edicao: dominio fixo e campos preenchidos com o estado atual do registro
    _dominios = [evento.dominio];
    _dominio = evento.dominio;
    _dataEvento = evento.dataEvento.toLocal();
    _titulo.text = evento.titulo;
    _observacao.text = evento.observacao ?? '';
    _tipo = _tipoPorNome(tiposDeContingencia, evento.tipoEvento);
    for (final campo in camposPorDominio[evento.dominio]!) {
      final valor = evento.detalhe[campo.nome];
      if (valor == null) continue;
      _controlador(campo.nome).text =
          campo.tipo == TipoCampo.decimal ? valor.toString().replaceAll('.', ',') : valor.toString();
    }
    final retorno = evento.detalhe['dataRetorno'] as String?;
    if (retorno != null) _dataRetorno = DateTime.parse(retorno);
  }

  TipoEvento? _tipoPorNome(Map<String, List<TipoEvento>> tipos, String nome) =>
      (tipos[_dominio] ?? const <TipoEvento>[]).where((t) => t.nome == nome).firstOrNull;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_origemTipos == null) _carregarTipos();
  }

  Future<void> _carregarTipos() async {
    final (tipos, origem) = await Dependencias.de(context).tiposEvento();
    if (!mounted) return;
    setState(() {
      _tipos = tipos;
      _origemTipos = origem;
      if (_tipo != null) _tipo = _tipoPorNome(tipos, _tipo!.nome);
    });
  }

  @override
  void dispose() {
    _titulo.dispose();
    _observacao.dispose();
    for (final controlador in _campos.values) {
      controlador.dispose();
    }
    super.dispose();
  }

  TextEditingController _controlador(String nome) => _campos.putIfAbsent(nome, TextEditingController.new);

  bool get _retornoObrigatorio => _dominio == 'saude' && (_tipo?.exigeRetorno ?? false);

  void _trocarDominio(String dominio) {
    setState(() {
      _dominio = dominio;
      _tipo = null;
      _dataRetorno = null;
      for (final controlador in _campos.values) {
        controlador.clear();
      }
    });
  }

  Future<void> _escolherDataEvento() async {
    final data = await showDatePicker(
      context: context,
      firstDate: DateTime(2000),
      lastDate: DateTime.now().add(const Duration(days: 365)),
      initialDate: _dataEvento,
    );
    if (data == null || !mounted) return;
    final hora = await showTimePicker(context: context, initialTime: TimeOfDay.fromDateTime(_dataEvento));
    setState(() => _dataEvento = DateTime(data.year, data.month, data.day, hora?.hour ?? _dataEvento.hour, hora?.minute ?? _dataEvento.minute));
  }

  // A data de retorno e sempre escolhida pela pessoa: nenhum valor e sugerido
  Future<void> _escolherDataRetorno() async {
    final data = await showDatePicker(
      context: context,
      firstDate: DateTime(2000),
      lastDate: DateTime(DateTime.now().year + 5, 12, 31),
      initialDate: _dataRetorno ?? DateTime.now(),
      helpText: 'Data de retorno',
    );
    if (data != null) setState(() => _dataRetorno = data);
  }

  Object? _valorDoCampo(CampoFormulario campo) {
    final texto = _controlador(campo.nome).text.trim();
    if (texto.isEmpty) return null;
    return switch (campo.tipo) {
      TipoCampo.inteiro => int.parse(texto),
      TipoCampo.decimal => num.parse(texto.replaceAll(',', '.')),
      _ => texto,
    };
  }

  String? _validarCampo(CampoFormulario campo, String? valor) {
    final texto = (valor ?? '').trim();
    if (texto.isEmpty) return campo.obrigatorio ? 'Informe ${campo.rotulo.toLowerCase()}.' : null;
    if (campo.tipo == TipoCampo.inteiro && int.tryParse(texto) == null) return 'Use apenas números inteiros.';
    if (campo.tipo == TipoCampo.decimal && num.tryParse(texto.replaceAll(',', '.')) == null) return 'Use um número, por exemplo 15,32.';
    return null;
  }

  Future<void> _salvar() async {
    final valido = _formulario.currentState!.validate();
    if (_retornoObrigatorio && _dataRetorno == null) {
      mostrarMensagem(context, 'Informe a data de retorno.', erro: true);
      return;
    }
    if (!valido) return;

    if (_editando) {
      await _salvarEdicao();
      return;
    }

    setState(() => _salvando = true);
    final dependencias = Dependencias.de(context);
    final detalhe = <String, dynamic>{
      for (final campo in camposPorDominio[_dominio]!)
        if (_valorDoCampo(campo) != null) campo.nome: _valorDoCampo(campo),
      if (_dominio == 'saude' && _dataRetorno != null) 'dataRetorno': paraDataIso(_dataRetorno!),
    };
    try {
      await dependencias.fila.registrar(
        usuarioId: dependencias.usuario!.id,
        animalId: widget.animal.id,
        corpo: {
          'dominio': _dominio,
          'tipoEvento': _tipo!.nome,
          'dataEvento': paraDataHoraIso(_dataEvento),
          'titulo': _titulo.text.trim(),
          if (_observacao.text.trim().isNotEmpty) 'observacao': _observacao.text.trim(),
          'detalhe': detalhe,
        },
      );
      final resultado = await dependencias.sincronizar();
      if (!mounted) return;
      final enviado = resultado != null && !resultado.interrompidoSemConexao && resultado.sincronizados > 0;
      mostrarMensagem(
        context,
        enviado ? 'Registro salvo e enviado.' : 'Registro salvo no aparelho. Será enviado quando houver conexão.',
      );
      Navigator.pop(context, true);
    } catch (erro) {
      if (mounted) mostrarErro(context, erro);
    } finally {
      if (mounted) setState(() => _salvando = false);
    }
  }

  // RF15: envia o estado completo do formulario; campo opcional esvaziado vai
  // como nulo. A versao lida permite ao servidor recusar edicao concorrente.
  Future<void> _salvarEdicao() async {
    setState(() => _salvando = true);
    final evento = widget.evento!;
    final detalhe = <String, dynamic>{
      for (final campo in camposPorDominio[_dominio]!) campo.nome: _valorDoCampo(campo),
      if (_dominio == 'saude') 'dataRetorno': _dataRetorno == null ? null : paraDataIso(_dataRetorno!),
    };
    try {
      await Dependencias.de(context).servico.editarEvento(evento.id, {
        'versao': evento.versao,
        'tipoEvento': _tipo!.nome,
        'dataEvento': paraDataHoraIso(_dataEvento),
        'titulo': _titulo.text.trim(),
        'observacao': _observacao.text.trim().isEmpty ? null : _observacao.text.trim(),
        'detalhe': detalhe,
      });
      if (!mounted) return;
      mostrarMensagem(context, 'Registro alterado.');
      Navigator.pop(context, true);
    } on ErroApi catch (erro) {
      if (!mounted) return;
      if (erro.status == 409) {
        mostrarMensagem(context, 'Este registro foi alterado por outra pessoa. Volte e abra de novo para ver a versão atual.', erro: true);
      } else {
        mostrarErro(context, erro);
      }
    } on SemConexaoException {
      if (mounted) mostrarMensagem(context, 'Para alterar um registro é preciso estar com conexão.', erro: true);
    } catch (erro) {
      if (mounted) mostrarErro(context, erro);
    } finally {
      if (mounted) setState(() => _salvando = false);
    }
  }

  Widget _campoTexto(CampoFormulario campo) {
    final numerico = campo.tipo == TipoCampo.inteiro || campo.tipo == TipoCampo.decimal;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextFormField(
        key: Key('campo-${campo.nome}'),
        controller: _controlador(campo.nome),
        maxLength: campo.maximo,
        keyboardType: numerico ? const TextInputType.numberWithOptions(decimal: true) : TextInputType.text,
        inputFormatters: campo.tipo == TipoCampo.inteiro ? [FilteringTextInputFormatter.digitsOnly] : null,
        decoration: InputDecoration(
          labelText: campo.obrigatorio ? '${campo.rotulo} *' : campo.rotulo,
          border: const OutlineInputBorder(),
          counterText: '',
        ),
        validator: (v) => _validarCampo(campo, v),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final campos = camposPorDominio[_dominio]!;
    final principais = campos.where((c) => c.obrigatorio).toList();
    final adicionais = campos.where((c) => !c.obrigatorio).toList();
    final botaoRetorno = OutlinedButton.icon(
      key: const Key('botao-data-retorno'),
      icon: const Icon(Icons.event_repeat),
      label: Text(_dataRetorno == null
          ? (_retornoObrigatorio ? 'Data de retorno *' : 'Data de retorno')
          : 'Retorno em ${exibirData(_dataRetorno!)}'),
      onPressed: _escolherDataRetorno,
    );

    return Scaffold(
      appBar: AppBar(title: Text('${_editando ? 'Editar registro' : 'Novo registro'} · ${widget.animal.nome}')),
      body: Form(
        key: _formulario,
        child: ListView(padding: const EdgeInsets.all(16), children: [
          if (_dominios.length > 1) ...[
            SegmentedButton<String>(
              segments: [
                for (final d in _dominios)
                  ButtonSegment(value: d, icon: Icon(iconesDominio[d]), label: Text(nomesDominio[d]!)),
              ],
              selected: {_dominio},
              onSelectionChanged: (s) => _trocarDominio(s.first),
              showSelectedIcon: false,
            ),
            const SizedBox(height: 16),
          ] else
            Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: Text(nomesDominio[_dominio]!, style: Theme.of(context).textTheme.titleMedium),
            ),
          DropdownButtonFormField<TipoEvento>(
            key: ValueKey('tipo-$_dominio-$_origemTipos'),
            initialValue: _tipo,
            decoration: const InputDecoration(labelText: 'Tipo *', border: OutlineInputBorder()),
            items: [
              for (final tipo in _tipos[_dominio] ?? const <TipoEvento>[])
                DropdownMenuItem(value: tipo, child: Text(nomesTipo[tipo.nome] ?? tipo.nome)),
            ],
            onChanged: (tipo) => setState(() => _tipo = tipo),
            validator: (v) => v == null ? 'Escolha o tipo.' : null,
          ),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            icon: const Icon(Icons.schedule),
            label: Text('Data *: ${exibirDataHora(_dataEvento)}'),
            onPressed: _escolherDataEvento,
          ),
          const SizedBox(height: 12),
          TextFormField(
            key: const Key('campo-titulo'),
            controller: _titulo,
            maxLength: 140,
            decoration: const InputDecoration(labelText: 'Título *', border: OutlineInputBorder(), counterText: ''),
            validator: (v) => (v == null || v.trim().isEmpty) ? 'Informe o título.' : null,
          ),
          const SizedBox(height: 12),
          for (final campo in principais) _campoTexto(campo),
          if (_retornoObrigatorio) botaoRetorno,
          ExpansionTile(
            title: const Text('Mais informações'),
            tilePadding: EdgeInsets.zero,
            childrenPadding: const EdgeInsets.only(top: 8),
            children: [
              for (final campo in adicionais) _campoTexto(campo),
              if (_dominio == 'saude' && !_retornoObrigatorio) Padding(padding: const EdgeInsets.only(bottom: 12), child: botaoRetorno),
              TextFormField(
                controller: _observacao,
                maxLines: 3,
                decoration: const InputDecoration(labelText: 'Observação', border: OutlineInputBorder()),
              ),
            ],
          ),
          const SizedBox(height: 24),
          FilledButton.icon(
            onPressed: _salvando ? null : _salvar,
            icon: const Icon(Icons.save_outlined),
            label: Text(_editando ? 'Salvar alterações' : 'Salvar registro'),
            style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52)),
          ),
        ]),
      ),
    );
  }
}
