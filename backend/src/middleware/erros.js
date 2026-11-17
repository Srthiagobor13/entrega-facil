export class HttpError extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.status = status;
  }
}

export const rotaNaoEncontrada = (_req, _res, next) => next(new HttpError(404, 'Rota não encontrada'));

// eslint-disable-next-line no-unused-vars
export function tratarErros(err, _req, res, _next) {
  if (err instanceof HttpError) return res.status(err.status).json({ erro: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ erro: 'JSON inválido' });
  if (err.type === 'entity.too.large') return res.status(413).json({ erro: 'Requisição muito grande' });
  console.error(err);
  return res.status(500).json({ erro: 'Erro interno' });
}
