const telegramService = require('../../services/telegram.service');
const { AVISO_SIN_VINCULO } = require('../auth');

const BIENVENIDA = [
  '👋 Soy el bot de <b>misgastos</b>.',
  '',
  'Sirvo para que cargues gastos e ingresos sin abrir la web: escribís el monto y el resto lo elegís con botones.',
].join('\n');

const AYUDA = [
  '<b>Cómo cargar</b>',
  'Mandame el monto y una descripción corta:',
  '<code>1500 super</code>',
  '',
  'Podés agregar, en cualquier orden:',
  '• una fecha: <code>ayer</code>, <code>hoy</code> o <code>28/8</code>',
  '• cuotas: <code>x3</code> o <code>3 cuotas</code>',
  '• un <code>+</code> adelante para que sea un ingreso: <code>+ 250000 sueldo</code>',
  '',
  '<b>Comandos</b>',
  '/gasto — cargar un gasto paso a paso',
  '/ingreso — cargar un ingreso paso a paso',
  '/ultimos — ver y borrar lo último que cargaste',
  '/mes — resumen del mes en curso',
  '/cancelar — descartar lo que estés cargando',
  '/desvincular — desconectar este chat',
].join('\n');

function nombreDelChat(ctx) {
  const from = ctx.from || {};
  const partes = [from.first_name, from.last_name].filter(Boolean);
  const nombre = partes.join(' ').trim();
  return from.username ? `@${from.username}` : (nombre || `Chat ${ctx.chat.id}`);
}

function registrar(bot) {
  bot.command('start', async (ctx) => {
    if (ctx.chat?.type !== 'private') return;

    const usuario = await telegramService.resolverUsuario(ctx.chat.id);
    if (!usuario) {
      await ctx.reply(`${BIENVENIDA}\n\n${AVISO_SIN_VINCULO}`, { parse_mode: 'HTML' });
      return;
    }

    await ctx.reply(`${BIENVENIDA}\n\nEstás conectado como <b>${usuario.nombre}</b>.\n\n${AYUDA}`, {
      parse_mode: 'HTML',
    });
  });

  bot.command(['ayuda', 'help'], async (ctx) => {
    if (ctx.chat?.type !== 'private') return;
    await ctx.reply(AYUDA, { parse_mode: 'HTML' });
  });

  bot.command('vincular', async (ctx) => {
    if (ctx.chat?.type !== 'private') return;

    const codigo = (ctx.match || '').trim();
    if (!codigo) {
      await ctx.reply('Mandame el código así: /vincular ABC123');
      return;
    }

    try {
      const vinculo = await telegramService.vincular(codigo, ctx.chat.id, nombreDelChat(ctx));
      await ctx.reply(
        `✅ Listo, quedaste conectado como <b>${vinculo.usuario.nombre}</b>.\n\n${AYUDA}`,
        { parse_mode: 'HTML' },
      );
    } catch (err) {
      await ctx.reply(`⚠️ ${err.message}`);
    }
  });

  bot.command('desvincular', async (ctx) => {
    if (ctx.chat?.type !== 'private') return;

    const desvinculado = await telegramService.desvincularPorChat(ctx.chat.id);
    await ctx.reply(desvinculado
      ? 'Listo, este chat quedó desconectado. Para volver a usarlo generá un código nuevo desde la web.'
      : 'Este chat no estaba vinculado.');
  });
}

module.exports = { registrar };
