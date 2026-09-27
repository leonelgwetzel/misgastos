const prisma = require('../lib/prisma');
const cuentaService = require('../services/cuenta.service');
const tarjetaService = require('../services/tarjeta.service');
const categoriaService = require('../services/categoria.service');
const gastoService = require('../services/gasto.service');
const ingresoService = require('../services/ingreso.service');
const { formatMoney, parseInputDate } = require('../lib/dates');
const teclados = require('./keyboards');

const SIN_ELEGIR = null;
const SIN_VALOR = '';

function escaparHtml(texto) {
  return String(texto || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatearFecha(iso) {
  const fecha = parseInputDate(iso);
  if (!fecha) return iso;
  return fecha.toLocaleDateString('es-AR', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
}

async function cargarContexto(usuario) {
  const [cuentas, tarjetas, categorias] = await Promise.all([
    cuentaService.listByUser(usuario.id),
    tarjetaService.listByUser(usuario.id),
    categoriaService.listByUser(usuario.id),
  ]);

  return {
    usuario,
    cuentas,
    tarjetas: tarjetas.filter((t) => t.titularidad === 'PROPIA'),
    categorias,
  };
}

function crear({ tipo, monto, descripcion, fecha, cuotas }) {
  return {
    tipo,
    monto,
    descripcion: descripcion || '',
    fecha,
    cuotasSugeridas: cuotas || null,
    medioPago: SIN_ELEGIR,
    cuentaId: SIN_ELEGIR,
    tarjetaId: SIN_ELEGIR,
    cantidadCuotas: SIN_ELEGIR,
    categoriaId: SIN_ELEGIR,
    messageId: null,
  };
}

/**
 * Adelanta los pasos que no tienen nada que preguntar: sin tarjetas no hay
 * medio "tarjeta", sin cuentas no hay a qué imputar, y las cuotas escritas en
 * el mensaje original evitan preguntar de nuevo.
 */
function autocompletar(b, contexto) {
  if (b.tipo === 'gasto') {
    if (b.medioPago && b.medioPago !== 'TARJETA' && contexto.cuentas.length === 0) {
      b.cuentaId = SIN_VALOR;
    }
    if (b.medioPago === 'TARJETA') {
      if (b.tarjetaId === SIN_ELEGIR && contexto.tarjetas.length === 1) {
        b.tarjetaId = contexto.tarjetas[0].id;
      }
      if (b.cantidadCuotas === SIN_ELEGIR && b.cuotasSugeridas) {
        b.cantidadCuotas = b.cuotasSugeridas;
      }
    }
  }
  if (contexto.categorias.length === 0) b.categoriaId = SIN_VALOR;
  return b;
}

function pasoActual(b) {
  if (!b.descripcion && b.tipo === 'gasto') return 'descripcion';

  if (b.tipo === 'gasto') {
    if (!b.medioPago) return 'medio';
    if (b.medioPago === 'TARJETA') {
      if (b.tarjetaId === SIN_ELEGIR) return 'tarjeta';
      if (b.cantidadCuotas === SIN_ELEGIR) return 'cuotas';
    } else if (b.cuentaId === SIN_ELEGIR) {
      return 'cuenta';
    }
  } else if (!b.cuentaId) {
    return 'cuenta';
  }

  if (b.categoriaId === SIN_ELEGIR) return 'categoria';
  return 'confirmar';
}

function simboloDe(b, contexto) {
  if (b.medioPago === 'TARJETA' && b.tarjetaId) {
    const tarjeta = contexto.tarjetas.find((t) => t.id === b.tarjetaId);
    if (tarjeta?.divisa) return tarjeta.divisa.simbolo;
  }
  if (b.cuentaId) {
    const cuenta = contexto.cuentas.find((c) => c.id === b.cuentaId);
    if (cuenta?.divisa) return cuenta.divisa.simbolo;
  }
  return contexto.usuario.divisaPrincipal?.simbolo || '$';
}

const ETIQUETA_MEDIO = { EFECTIVO: 'Efectivo', DEBITO: 'Débito', TARJETA: 'Tarjeta de crédito' };

function resumen(b, contexto) {
  const lineas = [
    b.tipo === 'ingreso' ? '💚 <b>Ingreso</b>' : '🧾 <b>Gasto</b>',
    `💰 <b>${formatMoney(b.monto, simboloDe(b, contexto))}</b>`,
  ];

  if (b.descripcion) lineas.push(`📝 ${escaparHtml(b.descripcion)}`);
  lineas.push(`📅 ${formatearFecha(b.fecha)}`);

  if (b.medioPago === 'TARJETA') {
    const tarjeta = contexto.tarjetas.find((t) => t.id === b.tarjetaId);
    const detalle = [tarjeta ? escaparHtml(tarjeta.alias) : 'Tarjeta'];
    if (b.cantidadCuotas) {
      detalle.push(b.cantidadCuotas === 1 ? '1 pago' : `${b.cantidadCuotas} cuotas`);
    }
    lineas.push(`💳 ${detalle.join(' · ')}`);
  } else if (b.medioPago) {
    const cuenta = contexto.cuentas.find((c) => c.id === b.cuentaId);
    const detalle = [ETIQUETA_MEDIO[b.medioPago]];
    if (cuenta) detalle.push(escaparHtml(cuenta.nombre));
    else if (b.cuentaId === SIN_VALOR) detalle.push('sin cuenta');
    lineas.push(`💵 ${detalle.join(' · ')}`);
  } else if (b.tipo === 'ingreso') {
    const cuenta = contexto.cuentas.find((c) => c.id === b.cuentaId);
    if (cuenta) lineas.push(`🏦 ${escaparHtml(cuenta.nombre)}`);
  }

  if (b.categoriaId) {
    const categoria = contexto.categorias.find((c) => c.id === b.categoriaId);
    if (categoria) lineas.push(`🏷 ${escaparHtml(categoria.nombre)}`);
  } else if (b.categoriaId === SIN_VALOR) {
    lineas.push('🏷 Sin categoría');
  }

  return lineas.join('\n');
}

const PREGUNTAS = {
  descripcion: '¿En qué fue? Escribime una descripción corta.',
  medio: '¿Cómo lo pagaste?',
  cuenta: '¿De qué cuenta sale?',
  tarjeta: '¿Con qué tarjeta?',
  cuotas: '¿En cuántas cuotas?',
  categoria: '¿Qué categoría le ponemos?',
  confirmar: '¿Lo guardo así?',
};

function tecladoDe(paso, b, contexto) {
  switch (paso) {
    case 'medio':
      return teclados.medioPago({ hayTarjetas: contexto.tarjetas.length > 0 });
    case 'cuenta':
      return teclados.cuentas(contexto.cuentas, { permitirSinCuenta: b.tipo === 'gasto' });
    case 'tarjeta':
      return teclados.tarjetas(contexto.tarjetas);
    case 'cuotas':
      return teclados.cuotas();
    case 'categoria':
      return teclados.categorias(contexto.categorias);
    case 'confirmar':
      return teclados.confirmar();
    default:
      return undefined;
  }
}

/** Dibuja el borrador: edita el mensaje anterior si existe, si no manda uno nuevo. */
async function mostrar(ctx, b, contexto) {
  autocompletar(b, contexto);
  const paso = pasoActual(b);
  const texto = `${resumen(b, contexto)}\n\n<b>${PREGUNTAS[paso]}</b>`;
  const opciones = { parse_mode: 'HTML', reply_markup: tecladoDe(paso, b, contexto) };

  if (b.messageId) {
    try {
      await ctx.api.editMessageText(ctx.chat.id, b.messageId, texto, opciones);
      return b;
    } catch {
      // El mensaje pudo haber sido borrado: caemos a mandar uno nuevo.
    }
  }

  const enviado = await ctx.reply(texto, opciones);
  b.messageId = enviado.message_id;
  return b;
}

async function resolverDivisaId(usuario, cuenta) {
  if (cuenta) return cuenta.divisaId;
  if (usuario.divisaPrincipalId) return usuario.divisaPrincipalId;

  const divisa = await prisma.divisa.findFirst({ where: { usuarioId: usuario.id } });
  if (!divisa) throw new Error('No tenés divisas configuradas. Cargá una desde la web.');
  return divisa.id;
}

/** Persiste el borrador usando los mismos servicios que la web. */
async function guardar(b, contexto) {
  const { usuario } = contexto;

  if (b.tipo === 'ingreso') {
    const movimiento = await ingresoService.create(usuario.id, {
      cuentaId: b.cuentaId,
      monto: b.monto,
      fecha: b.fecha,
      descripcion: b.descripcion,
      categoriaId: b.categoriaId || '',
    });
    return { tipo: 'i', id: movimiento.id };
  }

  if (b.medioPago === 'TARJETA') {
    const gasto = await gastoService.createTarjetaGasto(usuario.id, {
      tarjetaId: b.tarjetaId,
      montoOriginal: b.monto,
      fechaCompra: b.fecha,
      descripcion: b.descripcion,
      categoriaId: b.categoriaId || '',
      cantidadCuotas: b.cantidadCuotas || 1,
      mesImpactoPrimera: '',
    });
    return { tipo: 'g', id: gasto.id };
  }

  const cuenta = contexto.cuentas.find((c) => c.id === b.cuentaId) || null;
  const gasto = await gastoService.createEfectivoDebitoGasto(usuario.id, {
    medioPago: b.medioPago,
    montoOriginal: b.monto,
    divisaId: await resolverDivisaId(usuario, cuenta),
    fechaCompra: b.fecha,
    descripcion: b.descripcion,
    categoriaId: b.categoriaId || '',
    cuentaId: b.cuentaId || '',
  });
  return { tipo: 'g', id: gasto.id };
}

module.exports = {
  SIN_ELEGIR,
  SIN_VALOR,
  cargarContexto,
  crear,
  pasoActual,
  resumen,
  mostrar,
  guardar,
  escaparHtml,
  formatearFecha,
};
