// Carrega o recurso indicado na rota antes da autorizacao, para que o
// middleware autorizar conheca o animal a que ele pertence (req.recurso.animalId).

const { naoEncontrado } = require("../dominio/erros");

function carregarRecurso(buscar) {
  return async function (req, res, next) {
    try {
      const recurso = await buscar(req);
      if (!recurso) throw naoEncontrado();
      req.recurso = recurso;
      return next();
    } catch (erro) {
      return next(erro);
    }
  };
}

module.exports = { carregarRecurso };
