const prisma = require('../../lib/prisma');
const dashboardService = require('../../services/dashboard.service');
const gastoFijoService = require('../../services/gastoFijo.service');
const ingresoFijoService = require('../../services/ingresoFijo.service');
const gastoService = require('../../services/gasto.service');
const ingresoService = require('../../services/ingreso.service');
const { parseMonthParams, formatMoney, formatDbDateInput } = require('../../lib/dates');
const teclados = require('../keyboards');
const { escaparHtml, formatearFecha } = require('../borrador');

const LIMITE_ULTIMOS = 5;

/** Lo último cargado desde cualquier lado, ordenado por fecha de alta. */
async function ultimosMovimientos(userId) {
  const [gastos, ingresos] = await Promise.all([
    prisma.gasto.findMany({
      where: { usuarioId: userId, gastoFijoId: null },
      include: { divisa: true, categoria: true },
      orderBy: { createdAt: 'desc' },
      take: LIMITE_ULTIMOS,
    }),
    prisma.movimiento.findMany({
      where: { usuarioId: userId, tipo: 'INGRESO', ingresoFijoId: null, gastoId: null },
      include: { divisa: true, categoria: true },
      orderBy: { createdAt: 'desc' },
      take: LIMITE_ULTIMOS,
    }),
  ]);

  const items = [
    ...gastos.map((g) => ({
      tipo: 'g',
      id: g.id,
      creado: g.createdAt,
      fecha: formatDbDateInput(g.fechaCompra),
      descripcion: g.descripcion,
      monto: Number(g.montoOriginal),
      simbolo: g.divisa?.simbolo || '$',
      categoria: g.categoria?.nombre || null,
      detalle: g.medioPago === 'TARJETA'
        ? `tarjeta${g.cantidadCuotas > 1 ? ` en ${g.cantidadCuotas} cuotas` : ''}`
        : g.medioPago.toLowerCase(),
    })),
    ...ingresos.map((m) => ({
      tipo: 'i',
      id: m.id,
      creado: m.createdAt,
      fecha: formatDbDateInput(m.fecha),
      descripcion: m.descripcion || 'Ingreso',
      monto: Number(m.monto),
      simbolo: m.divisa?.simbolo || '$',
      categoria: m.categoria?.nombre || null,
      detalle: 'ingreso',
    })),
  ];

  return items
    .sort((a, b) => b.creado - a.creado)
    .slice(0, LIMITE_ULTIMOS);
}

function textoUltimos(items) {
  if (items.length === 0) {
    return 'Todavía no cargaste nada. Mandame un monto, por ejemplo <code>1500 super</code>.';
  }

  const lineas = items.map((item, i) => {
    const signo = item.tipo === 'i' ? '+' : '−';
    const extra = [item.detalle, item.categoria].filter(Boolean).join(' · ');
    return [
      `<b>${i + 1}.</b> ${signo}${formatMoney(item.monto, item.simbolo)} — ${escaparHtml(item.descripcion)}`,
      `     <i>${formatearFecha(item.fecha)} · ${escaparHtml(extra)}</i>`,
    ].join('\n');
  });

  return `🕑 <b>Lo último que cargaste</b>\n\n${lineas.join('\n')}\n\nTocá el número para borrarlo.`;
}

async function mostrarUltimos(ctx, { editar = false } = {}) {
  const items = await ultimosMovimientos(ctx.usuario.id);
  const opciones = {
    parse_mode: 'HTML',
    reply_markup: items.length > 0 ? teclados.borrar(items) : undefined,
  };

  if (editar) {
    await ctx.editMessageText(textoUltimos(items), opciones);
    return;
  }
  await ctx.reply(textoUltimos(items), opciones);
}

async function textoMes(userId) {
  const { key, label } = parseMonthParams({});

  await gastoFijoService.generateForMonth(userId, key);
  await ingresoFijoService.generateForMonth(userId, key);

  const [plata, compromisos] = await Promise.all([
    dashboardService.getVistaPlata(userId, key),
    dashboardService.getVistaCompromisos(userId, key),
  ]);

  if (plata.mensaje) return `📅 <b>${label}</b>\n\n${escaparHtml(plata.mensaje)}`;

  const enVerde = Number(plata.resultado) >= 0;
  const lineas = [
    `📅 <b>${label}</b>`,
    '',
    `${enVerde ? '🟢' : '🔴'} <b>Resultado: ${plata.resultadoFormateado}</b>`,
    `${enVerde ? 'Te sobra plata este mes.' : 'Te falta plata este mes.'}`,
    '',
    `↗️ Ingresos: <b>${plata.totalIngresosFormateado}</b>`,
    `↘️ Egresos: <b>${plata.totalEgresosConTarjetasFormateado}</b>`,
    `　 · efectivo y débito: ${plata.totalEgresosFormateado}`,
    `　 · tarjetas: ${plata.pagoTarjetasFormateado}`,
    '',
    `👛 Saldo proyectado al cierre: <b>${plata.saldoCuentasFormateado}</b>`,
  ];

  const top = (plata.categoriasPie?.todos || []).slice(0, 3);
  if (top.length > 0) {
    lineas.push('', '<b>Dónde se va la plata</b>');
    top.forEach((cat) => {
      lineas.push(`• ${escaparHtml(cat.alias)}: ${cat.totalFormateado} (${cat.pct}%)`);
    });
  }

  if (compromisos?.culminados?.count > 0) {
    lineas.push(
      '',
      `🏁 Terminan ${compromisos.culminados.count} cuota(s) por ${compromisos.culminados.totalFormateado}.`,
    );
  }

  return lineas.join('\n');
}

function registrar(bot) {
  bot.command('ultimos', async (ctx) => {
    await mostrarUltimos(ctx);
  });

  bot.command('mes', async (ctx) => {
    await ctx.reply(await textoMes(ctx.usuario.id), { parse_mode: 'HTML' });
  });

  // Deshacer lo recién guardado: el mensaje muestra un único movimiento.
  bot.callbackQuery(/^u:/, async (ctx) => {
    const [, tipo, id] = ctx.callbackQuery.data.split(':');
    try {
      if (tipo === 'g') await gastoService.deleteGasto(ctx.usuario.id, id);
      else await ingresoService.remove(ctx.usuario.id, id);

      await ctx.editMessageText('↩️ Lo borré.');
      await ctx.answerCallbackQuery({ text: 'Borrado' });
    } catch (err) {
      await ctx.answerCallbackQuery({ text: `⚠️ ${err.message}`, show_alert: true });
    }
  });

  // Borrar desde la lista de /ultimos: hay que redibujar la lista completa.
  bot.callbackQuery(/^d:/, async (ctx) => {
    const [, tipo, id] = ctx.callbackQuery.data.split(':');
    try {
      if (tipo === 'g') await gastoService.deleteGasto(ctx.usuario.id, id);
      else await ingresoService.remove(ctx.usuario.id, id);

      await ctx.answerCallbackQuery({ text: 'Borrado' });
      await mostrarUltimos(ctx, { editar: true });
    } catch (err) {
      await ctx.answerCallbackQuery({ text: `⚠️ ${err.message}`, show_alert: true });
    }
  });
}

module.exports = { registrar };
