const borrador = require('../borrador');
const teclados = require('../keyboards');
const { parsearEntrada } = require('../parser');

const EJEMPLO_GASTO = 'Mandame el monto y en qué fue. Por ejemplo: <code>1500 super</code>';
const EJEMPLO_INGRESO = 'Mandame el monto del ingreso. Por ejemplo: <code>250000 sueldo</code>';

function mensajeDeError(err) {
  if (err.issues?.length) return err.issues.map((i) => i.message).join(' · ');
  return err.message || 'No pude guardarlo.';
}

async function iniciar(ctx, entrada) {
  const parsed = parsearEntrada(entrada);
  if (parsed.error) {
    await ctx.reply(parsed.error);
    return;
  }

  if (ctx.session.forzarTipo) {
    parsed.tipo = ctx.session.forzarTipo;
    ctx.session.forzarTipo = null;
  }

  const contexto = await borrador.cargarContexto(ctx.usuario);

  if (parsed.tipo === 'ingreso' && contexto.cuentas.length === 0) {
    await ctx.reply('Para cargar un ingreso necesitás al menos una cuenta. Creá una desde Configuración → Cuentas.');
    return;
  }

  ctx.session.borrador = borrador.crear(parsed);
  await borrador.mostrar(ctx, ctx.session.borrador, contexto);
}

async function guardar(ctx, b) {
  const contexto = await borrador.cargarContexto(ctx.usuario);

  let creado;
  try {
    creado = await borrador.guardar(b, contexto);
  } catch (err) {
    await ctx.answerCallbackQuery({ text: `⚠️ ${mensajeDeError(err)}`, show_alert: true });
    return;
  }

  ctx.session.borrador = null;

  await ctx.api.editMessageText(
    ctx.chat.id,
    b.messageId,
    `✅ <b>Guardado</b>\n\n${borrador.resumen(b, contexto)}`,
    { parse_mode: 'HTML', reply_markup: teclados.deshacer(creado.tipo, creado.id) },
  );
  await ctx.answerCallbackQuery({ text: 'Guardado' });
}

function aplicarOpcion(b, campo, valor) {
  switch (campo) {
    case 'medio':
      b.medioPago = valor;
      if (valor !== 'TARJETA') {
        b.tarjetaId = borrador.SIN_ELEGIR;
        b.cantidadCuotas = borrador.SIN_ELEGIR;
      } else {
        b.cuentaId = borrador.SIN_ELEGIR;
      }
      return true;
    case 'cuenta':
      b.cuentaId = valor === teclados.SIN_VALOR ? borrador.SIN_VALOR : valor;
      return true;
    case 'tarjeta':
      b.tarjetaId = valor;
      return true;
    case 'cuotas':
      b.cantidadCuotas = Number(valor);
      return true;
    case 'cat':
      b.categoriaId = valor === teclados.SIN_VALOR ? borrador.SIN_VALOR : valor;
      return true;
    default:
      return false;
  }
}

function registrar(bot) {
  bot.command('gasto', async (ctx) => {
    ctx.session.borrador = null;
    ctx.session.forzarTipo = 'gasto';
    await ctx.reply(EJEMPLO_GASTO, { parse_mode: 'HTML' });
  });

  bot.command('ingreso', async (ctx) => {
    ctx.session.borrador = null;
    ctx.session.forzarTipo = 'ingreso';
    await ctx.reply(EJEMPLO_INGRESO, { parse_mode: 'HTML' });
  });

  bot.command('cancelar', async (ctx) => {
    const habia = Boolean(ctx.session.borrador);
    ctx.session.borrador = null;
    ctx.session.forzarTipo = null;
    await ctx.reply(habia ? 'Listo, lo descarté.' : 'No tenías nada a medio cargar.');
  });

  bot.callbackQuery(/^b:/, async (ctx) => {
    const b = ctx.session.borrador;
    const mensajeId = ctx.callbackQuery.message?.message_id;

    if (!b || b.messageId !== mensajeId) {
      await ctx.answerCallbackQuery({ text: 'Ese borrador ya no está vigente.' });
      return;
    }

    const [, campo, valor] = ctx.callbackQuery.data.split(':');

    if (campo === 'cancel') {
      ctx.session.borrador = null;
      await ctx.editMessageText('✖️ Descartado.');
      await ctx.answerCallbackQuery({ text: 'Descartado' });
      return;
    }

    if (campo === 'ok') {
      await guardar(ctx, b);
      return;
    }

    if (!aplicarOpcion(b, campo, valor)) {
      await ctx.answerCallbackQuery();
      return;
    }

    const contexto = await borrador.cargarContexto(ctx.usuario);
    await borrador.mostrar(ctx, b, contexto);
    await ctx.answerCallbackQuery();
  });

  bot.on('message:text', async (ctx) => {
    const texto = ctx.message.text.trim();
    if (texto.startsWith('/')) {
      await ctx.reply('No conozco ese comando. Probá /ayuda.');
      return;
    }

    const b = ctx.session.borrador;
    if (b && borrador.pasoActual(b) === 'descripcion') {
      b.descripcion = texto.slice(0, 200);
      const contexto = await borrador.cargarContexto(ctx.usuario);
      await borrador.mostrar(ctx, b, contexto);
      return;
    }

    await iniciar(ctx, texto);
  });
}

module.exports = { registrar };
