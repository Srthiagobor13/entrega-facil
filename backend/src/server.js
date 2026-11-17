import { openDb, seed } from './db.js';
import { createApp } from './app.js';

const db = openDb(process.env.DB_PATH || new URL('../data.db', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
seed(db);

const port = process.env.PORT || 3000;
createApp(db).listen(port, () => console.log(`EntregaFácil rodando em http://localhost:${port}`));
