// Endereco do servico. Padrao: maquina hospedeira vista pelo emulador Android.
// Em aparelho fisico, compile com --dart-define=API_URL=https://<ip>:3443
const urlApi = String.fromEnvironment('API_URL', defaultValue: 'https://10.0.2.2:3443');

// Fuso usado para exibir datas e agendar notificacoes
const fusoHorario = 'America/Sao_Paulo';
