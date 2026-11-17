export const SECRET = process.env.JWT_SECRET || 'dev-secret-trocar-em-producao';
export const PAPEIS = ['cliente', 'restaurante', 'entregador'];
export const PAGAMENTOS = ['pix', 'cartao', 'dinheiro'];

// Transições de status permitidas por papel: { statusAtual: [novosStatus] }
export const TRANSICOES = {
  restaurante: { recebido: ['preparando', 'cancelado'], preparando: ['pronto'] },
  entregador: { pronto: ['a_caminho'], a_caminho: ['entregue'] },
  cliente: { recebido: ['cancelado'] },
};
