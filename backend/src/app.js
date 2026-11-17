import express from 'express';
import helmet from 'helmet';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { criarRotas } from './routes/index.js';
import { rotaNaoEncontrada, tratarErros } from './middleware/erros.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Política de segurança de conteúdo: só recursos do próprio site (e as fontes do Google)
const csp = {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    fontSrc: ["'self'", 'https://fonts.gstatic.com'],
    imgSrc: ["'self'", 'data:'],
    connectSrc: ["'self'"],
    manifestSrc: ["'self'"],
    workerSrc: ["'self'"],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    frameAncestors: ["'none'"],
  },
};

// Monta a aplicação: API REST (/api) + front-end estático (View do MVC, pasta /frontend).
export function createApp(db, opcoes = {}) {
  const app = express();
  app.set('trust proxy', 1); // atrás do proxy da hospedagem, para o IP real do cliente
  app.use(helmet({ contentSecurityPolicy: csp })); // cabeçalhos de segurança e sem x-powered-by
  app.use(express.json({ limit: '50kb' }));
  app.use('/api', criarRotas(db, opcoes));
  app.use('/api', rotaNaoEncontrada);
  app.use(express.static(path.join(__dirname, '..', '..', 'frontend')));
  app.use(tratarErros);
  return app;
}
