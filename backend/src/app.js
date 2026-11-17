import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { criarRotas } from './routes/index.js';
import { rotaNaoEncontrada, tratarErros } from './middleware/erros.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Monta a aplicação: API REST (/api) + front-end estático (View do MVC, pasta /frontend).
export function createApp(db) {
  const app = express();
  app.use(express.json({ limit: '100kb' }));
  app.use('/api', criarRotas(db));
  app.use('/api', rotaNaoEncontrada);
  app.use(express.static(path.join(__dirname, '..', '..', 'frontend')));
  app.use(tratarErros);
  return app;
}
