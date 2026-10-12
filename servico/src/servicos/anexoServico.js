// Anexo de imagem ou documento a evento (RF20). O arquivo vai para o
// armazenamento de anexos; a tabela anexo guarda o caminho relativo.

const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const anexoRepo = require("../repositorios/anexoRepo");
const { emTransacao } = require("../repositorios/prisma");
const auditoria = require("./auditoriaServico");
const { configuracao } = require("./configuracao");
const { identificarTipo } = require("../dominio/tiposArquivo");
const { falhaDeValidacao, naoEncontrado } = require("../dominio/erros");

const TIPO_NAO_ACEITO = {
  campo: "arquivo",
  mensagem: "Envie uma imagem (JPG, PNG ou WEBP) ou um documento em PDF.",
};

// Nome exibido ao usuario: sem diretorios e com no maximo 200 caracteres
function nomeSeguro(nomeOriginal, extensao) {
  const base = path.basename(String(nomeOriginal ?? "")).replace(/[\u0000-\u001f]/g, "").trim();
  return (base || `anexo${extensao}`).slice(0, 200);
}

async function anexar(contexto, evento, arquivo) {
  if (!arquivo) {
    throw falhaDeValidacao([{ campo: "arquivo", mensagem: "Selecione um arquivo para anexar." }]);
  }
  const tipo = identificarTipo(arquivo.buffer);
  if (!tipo) throw falhaDeValidacao([TIPO_NAO_ACEITO]);

  const id = randomUUID();
  const caminhoRelativo = path.posix.join(evento.id, `${id}${tipo.extensao}`);
  const caminhoAbsoluto = path.join(configuracao.diretorioAnexos, caminhoRelativo);

  await fs.mkdir(path.dirname(caminhoAbsoluto), { recursive: true });
  await fs.writeFile(caminhoAbsoluto, arquivo.buffer, { flag: "wx" });

  try {
    const anexo = await emTransacao(async (tx) => {
      const criado = await anexoRepo.criar(
        {
          id,
          eventoId: evento.id,
          nomeArquivo: nomeSeguro(arquivo.originalname, tipo.extensao),
          caminho: caminhoRelativo,
          mimeType: tipo.mime,
          tamanhoBytes: arquivo.size,
          enviadoPor: contexto.usuarioId,
        },
        tx,
      );
      await auditoria.registrar(
        { usuarioId: contexto.usuarioId, acao: "anexo_enviado", entidade: "anexo", entidadeId: criado.id, enderecoIp: contexto.enderecoIp },
        tx,
      );
      return criado;
    });
    return {
      id: anexo.id,
      eventoId: anexo.eventoId,
      nomeArquivo: anexo.nomeArquivo,
      mimeType: anexo.mimeType,
      tamanhoBytes: anexo.tamanhoBytes,
    };
  } catch (erro) {
    // sem registro no banco, o arquivo gravado nao fica orfao
    await fs.rm(caminhoAbsoluto, { force: true });
    throw erro;
  }
}

// Localiza o arquivo de um anexo ja autorizado. O caminho gravado e relativo e
// conferido para nao sair do diretorio de anexos.
async function localizar(anexo) {
  const raiz = path.resolve(configuracao.diretorioAnexos);
  const caminhoAbsoluto = path.resolve(raiz, anexo.caminho);
  if (!caminhoAbsoluto.startsWith(raiz + path.sep)) throw naoEncontrado("Arquivo não encontrado.");
  try {
    await fs.access(caminhoAbsoluto);
  } catch {
    throw naoEncontrado("Arquivo não encontrado.");
  }
  return { caminhoAbsoluto, mimeType: anexo.mimeType ?? "application/octet-stream", nomeArquivo: anexo.nomeArquivo };
}

module.exports = { anexar, localizar };
