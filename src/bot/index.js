require('dotenv').config();

const { Bot, session, GrammyError, HttpError } = require('grammy');
const { requireVinculo } = require('./auth');
const vinculacion = require('./flows/vinculacion');
const carga = require('./flows/carga');
const consultas = require('./flows/consultas');

const COMANDOS = [
  { command: 'gasto', description: 'Cargar un gasto' },
  { command: 'ingreso', description: 'Cargar un ingreso' },
  { command: 'ultimos', description: 'Ver y borrar lo último cargado' },
  { command: 'mes', description: 'Resumen del mes en curso' },
  { command: 'cancelar', description: 'Descartar lo que estés cargando' },
  { command: 'ayuda', description: 'Cómo se usa' },
  { command: 'vincular', description: 'Conectar este chat con tu cuenta' },
  { command: 'desvincular', description: 'Desconectar este chat' },
];

function crearBot(token) {
  const bot = new Bot(token);

  bot.use(session({ initial: () => ({ borrador: null, forzarTipo: null }) }));

  // La vinculación es lo único que puede usar un chat todavía no asociado.
  vinculacion.registrar(bot);
  bot.use(requireVinculo);

  consultas.registrar(bot);
  carga.registrar(bot);

  bot.catch((err) => {
    const origen = err.ctx?.update?.update_id;
    if (err.error instanceof GrammyError) {
      console.error(`[bot] error de Telegram (update ${origen}):`, err.error.description);
    } else if (err.error instanceof HttpError) {
      console.error(`[bot] no pude contactar Telegram (update ${origen}):`, err.error);
    } else {
      console.error(`[bot] error al procesar el update ${origen}:`, err.error);
    }
  });

  return bot;
}

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    console.error('[bot] Falta TELEGRAM_BOT_TOKEN en el entorno. El bot no arranca.');
    process.exit(1);
  }

  const bot = crearBot(token);

  const detener = async () => {
    console.log('[bot] deteniendo…');
    await bot.stop();
  };
  process.once('SIGINT', detener);
  process.once('SIGTERM', detener);

  await bot.api.setMyCommands(COMANDOS);

  await bot.start({
    drop_pending_updates: true,
    onStart: (info) => console.log(`[bot] escuchando como @${info.username}`),
  });
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[bot] no pudo arrancar:', err);
    process.exit(1);
  });
}

module.exports = { crearBot, COMANDOS };
