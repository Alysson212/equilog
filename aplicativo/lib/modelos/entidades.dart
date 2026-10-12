// Representacoes das respostas da API (especificacao, secao 5).

class Usuario {
  final String id;
  final String nome;
  final String email;

  const Usuario({required this.id, required this.nome, required this.email});

  factory Usuario.deJson(Map<String, dynamic> json) =>
      Usuario(id: json['id'] as String, nome: json['nome'] as String, email: (json['email'] ?? '') as String);

  Map<String, dynamic> paraJson() => {'id': id, 'nome': nome, 'email': email};
}

class Animal {
  final String id;
  final String nome;
  final String? registroAssociacao;
  final String? dataNascimento;
  final String sexo;
  final String? pelagem;
  final bool ativo;
  final String papel;

  const Animal({
    required this.id,
    required this.nome,
    required this.sexo,
    required this.ativo,
    required this.papel,
    this.registroAssociacao,
    this.dataNascimento,
    this.pelagem,
  });

  factory Animal.deJson(Map<String, dynamic> json) => Animal(
        id: json['id'] as String,
        nome: json['nome'] as String,
        registroAssociacao: json['registroAssociacao'] as String?,
        dataNascimento: json['dataNascimento'] as String?,
        sexo: json['sexo'] as String,
        pelagem: json['pelagem'] as String?,
        ativo: json['ativo'] as bool,
        papel: json['papel'] as String,
      );
}

class ItemLinhaDoTempo {
  final String id;
  final String dominio;
  final String tipoEvento;
  final DateTime dataEvento;
  final String titulo;
  final String? observacao;
  final String autorId;
  final String autorNome;
  final int versao;
  final Map<String, dynamic> detalhe;
  // registro ainda na fila local, nao confirmado pelo servidor
  final String? situacaoLocal;

  const ItemLinhaDoTempo({
    required this.id,
    required this.dominio,
    required this.tipoEvento,
    required this.dataEvento,
    required this.titulo,
    required this.autorId,
    required this.autorNome,
    required this.versao,
    required this.detalhe,
    this.observacao,
    this.situacaoLocal,
  });

  factory ItemLinhaDoTempo.deJson(Map<String, dynamic> json) => ItemLinhaDoTempo(
        id: json['id'] as String,
        dominio: json['dominio'] as String,
        tipoEvento: json['tipoEvento'] as String,
        dataEvento: DateTime.parse(json['dataEvento'] as String),
        titulo: json['titulo'] as String,
        observacao: json['observacao'] as String?,
        autorId: (json['registradoPor'] as Map)['id'] as String,
        autorNome: (json['registradoPor'] as Map)['nome'] as String,
        versao: json['versao'] as int,
        detalhe: Map<String, dynamic>.from((json['detalhe'] ?? {}) as Map),
      );
}

class PaginaLinhaDoTempo {
  final List<ItemLinhaDoTempo> itens;
  final int total;
  const PaginaLinhaDoTempo(this.itens, this.total);
}

class Lembrete {
  final String id;
  final String animalId;
  final String animalNome;
  final String dataPrevista;
  final String status;
  final String papel;
  final String? eventoTitulo;
  final String? tipoEvento;

  const Lembrete({
    required this.id,
    required this.animalId,
    required this.animalNome,
    required this.dataPrevista,
    required this.status,
    required this.papel,
    this.eventoTitulo,
    this.tipoEvento,
  });

  factory Lembrete.deJson(Map<String, dynamic> json) {
    final evento = json['evento'] as Map<String, dynamic>?;
    return Lembrete(
      id: json['id'] as String,
      animalId: (json['animal'] as Map)['id'] as String,
      animalNome: (json['animal'] as Map)['nome'] as String,
      dataPrevista: json['dataPrevista'] as String,
      status: json['status'] as String,
      papel: json['papel'] as String,
      eventoTitulo: evento?['titulo'] as String?,
      tipoEvento: evento?['tipoEvento'] as String?,
    );
  }

  bool get emAberto => status == 'pendente' || status == 'adiado';
}

class Vinculo {
  final String id;
  final String usuarioNome;
  final String usuarioEmail;
  final String papel;
  final String dataInicio;
  final String? dataFim;
  final bool ativo;
  final bool vigente;

  const Vinculo({
    required this.id,
    required this.usuarioNome,
    required this.usuarioEmail,
    required this.papel,
    required this.dataInicio,
    required this.ativo,
    required this.vigente,
    this.dataFim,
  });

  factory Vinculo.deJson(Map<String, dynamic> json) => Vinculo(
        id: json['id'] as String,
        usuarioNome: (json['usuario'] as Map)['nome'] as String,
        usuarioEmail: (json['usuario'] as Map)['email'] as String,
        papel: json['papel'] as String,
        dataInicio: json['dataInicio'] as String,
        dataFim: json['dataFim'] as String?,
        ativo: json['ativo'] as bool,
        vigente: (json['vigente'] ?? json['ativo']) as bool,
      );
}
