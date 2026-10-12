// Adaptador para handlers assincronos no Express 4: rejeicoes vao para o
// tratador de erros em vez de ficarem sem resposta.

function assincrono(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

module.exports = { assincrono };
