// Operacoes do aplicativo contra o SERVIDOR REAL: cadastro pela tela de
// criar conta (RF01), edicao e inativacao do animal (RF05), edicao do evento
// com controle de versao (RF15) e exclusao logica (RF16).

import 'dart:io';

import 'package:equilog/servicos/api_cliente.dart';
import 'package:equilog/servicos/armazenamento_credenciais.dart';
import 'package:equilog/servicos/cliente_http.dart';
import 'package:equilog/servicos/equilog_servico.dart';
import 'package:equilog/sincronizacao/base_local.dart';
import 'package:equilog/sincronizacao/fila_sincronizacao.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:path/path.dart' as p;
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

import 'apoio_servidor.dart';

ApiCliente novoCliente() => ApiCliente(
      urlBase: urlServidor,
      clienteHttp: criarClienteHttp(certificadoConfiavel: certificadoDesenvolvimento()),
      credenciais: ArmazenamentoEmMemoria(),
    );

String emailUnico(String nome) => '$nome.${DateTime.now().microsecondsSinceEpoch}@app.teste.equilog';

void main() {
  sqfliteFfiInit();

  group('criar conta (RF01)', () {
    test('cadastra, entra e guarda o token de renovação', () async {
      final api = novoCliente();
      final email = emailUnico('cadastro');

      final usuario = await api.cadastrar(nome: 'Nova Pessoa', email: email, telefone: '(35) 98888-0000', senha: 'senha-segura-123');

      expect(usuario.nome, 'Nova Pessoa');
      expect(usuario.email, email);
      expect(api.autenticado, isTrue);
      expect(await api.credenciais.lerTokenRenovacao(), isNotNull);
      expect(await EquilogServico(api).listarAnimais(), isEmpty);
    });

    test('e-mail já cadastrado devolve mensagem compreensível', () async {
      final email = emailUnico('repetido');
      await novoCliente().cadastrar(nome: 'Primeira', email: email, senha: 'senha-segura-123');

      expect(
        () => novoCliente().cadastrar(nome: 'Segunda', email: email, senha: 'senha-segura-123'),
        throwsA(isA<ErroApi>()
            .having((e) => e.status, 'status', 422)
            .having((e) => e.mensagem, 'mensagem', 'Já existe uma conta com este e-mail.')),
      );
    });
  });

  group('editar e inativar animal (RF05)', () {
    test('proprietária altera dados, inativa e reativa', () async {
      final api = novoCliente();
      await api.cadastrar(nome: 'Dona', email: emailUnico('dona'), senha: 'senha-segura-123');
      final servico = EquilogServico(api);
      final animal = await servico.cadastrarAnimal({'nome': 'Brisa', 'sexo': 'F'});

      final editado = await servico.editarAnimal(animal.id, {'nome': 'Brisa do Vale', 'pelagem': 'Baia', 'dataNascimento': '2019-05-02'});
      expect(editado.nome, 'Brisa do Vale');
      expect(editado.pelagem, 'Baia');
      expect(editado.dataNascimento, '2019-05-02');

      final inativo = await servico.editarAnimal(animal.id, {'ativo': false});
      expect(inativo.ativo, isFalse);
      // o historico e o acesso continuam: o animal segue listado, marcado como inativo
      expect((await servico.listarAnimais()).single.ativo, isFalse);

      final reativado = await servico.editarAnimal(animal.id, {'ativo': true, 'pelagem': null});
      expect(reativado.ativo, isTrue);
      expect(reativado.pelagem, isNull);
    });
  });

  group('editar e excluir evento (RF15, RF16)', () {
    late Directory pasta;
    setUp(() async => pasta = await Directory.systemTemp.createTemp('equilog-operacoes-'));
    tearDown(() async => pasta.delete(recursive: true));

    test('autor edita com a versão lida; versão antiga dá conflito; exclusão some da linha do tempo', () async {
      final api = novoCliente();
      final usuario = await api.cadastrar(nome: 'Treinadora', email: emailUnico('autora'), senha: 'senha-segura-123');
      final servico = EquilogServico(api);
      final animal = await servico.cadastrarAnimal({'nome': 'Faísca', 'sexo': 'M'});

      // registro pela fila, como o aplicativo faz
      final base = await BaseLocal.abrir(caminho: p.join(pasta.path, 'equilog.db'), fabrica: databaseFactoryFfi);
      final fila = FilaSincronizacao(base: base, api: api);
      final local = await fila.registrar(usuarioId: usuario.id, animalId: animal.id, corpo: {
        'dominio': 'treinamento',
        'tipoEvento': 'trabalho de tambor',
        'dataEvento': '2026-10-15T16:00:00-03:00',
        'titulo': 'Treino',
        'detalhe': {'tipoExercicio': 'percurso', 'duracaoMin': 30, 'piso': 'areia'},
      });
      expect((await fila.processarFila(usuario.id)).sincronizados, 1);

      final editado = await servico.editarEvento(local.id, {
        'versao': 1,
        'titulo': 'Treino de tambor',
        'detalhe': {'tipoExercicio': 'percurso', 'duracaoMin': 45, 'piso': null},
      });
      expect(editado.versao, 2);
      expect(editado.titulo, 'Treino de tambor');
      expect(editado.detalhe['duracaoMin'], 45);
      expect(editado.detalhe['piso'], isNull);

      expect(
        () => servico.editarEvento(local.id, {'versao': 1, 'titulo': 'Versão antiga'}),
        throwsA(isA<ErroApi>().having((e) => e.status, 'status', 409)),
      );

      await servico.excluirEvento(local.id);
      expect((await servico.linhaDoTempo(animal.id)).total, 0);

      await fila.encerrar();
      await base.fechar();
    });

    test('quem não é autor não edita (403)', () async {
      final servidor = ServidorReal();
      final dona = await servidor.criarUsuario('Dona');
      final treinador = await servidor.criarUsuario('Treinador');
      final animalId = await servidor.criarAnimal(dona, 'Lua');
      await servidor.conceder(dona, animalId, treinador, 'treinador');

      final apiDona = novoCliente();
      await apiDona.entrar(dona.email, dona.senha);
      final servicoDona = EquilogServico(apiDona);
      final base = await BaseLocal.abrir(caminho: p.join(pasta.path, 'outra.db'), fabrica: databaseFactoryFfi);
      final fila = FilaSincronizacao(base: base, api: apiDona);
      final evento = await fila.registrar(usuarioId: dona.id, animalId: animalId, corpo: {
        'dominio': 'treinamento',
        'tipoEvento': 'descanso',
        'dataEvento': '2026-10-16T08:00:00-03:00',
        'titulo': 'Descanso',
        'detalhe': {'tipoExercicio': 'descanso'},
      });
      await fila.processarFila(dona.id);

      final apiTreinador = novoCliente();
      await apiTreinador.entrar(treinador.email, treinador.senha);
      expect(
        () => EquilogServico(apiTreinador).editarEvento(evento.id, {'versao': 1, 'titulo': 'Alterado'}),
        throwsA(isA<ErroApi>().having((e) => e.status, 'status', 403)),
      );
      // a proprietaria, mesmo nao sendo autora, pode excluir (RF16)
      await servicoDona.excluirEvento(evento.id);

      await fila.encerrar();
      await base.fechar();
      servidor.fechar();
    });
  });
}
