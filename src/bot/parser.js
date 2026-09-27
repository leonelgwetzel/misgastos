const { roundMoney } = require('../lib/money');
const { utcToday, utcDate, formatDbDateInput } = require('../lib/dates');

const RE_MONTO = /^\$?(\d[\d.,]*)(k)?$/i;
const RE_FECHA_NUMERICA = /^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2}|\d{4}))?$/;
const RE_CUOTAS_PREFIJO = /^x(\d{1,2})$/i;
const RE_CUOTAS_SUFIJO = /^(\d{1,2})x$/i;
const RE_PALABRA_CUOTAS = /^cuotas?$/i;

const DIAS_RELATIVOS = { hoy: 0, ayer: 1, anteayer: 2 };

function desplazarDias(base, dias) {
  return utcDate(
    base.getUTCFullYear(),
    base.getUTCMonth() + 1,
    base.getUTCDate() - dias,
  );
}

/**
 * Interpreta un número escrito a la argentina. El punto es separador de miles
 * cuando deja exactamente tres dígitos atrás; si no, se toma como decimal.
 */
function parsearNumero(crudo) {
  let texto = crudo.replace(/\s/g, '');
  const tieneComa = texto.includes(',');
  const tienePunto = texto.includes('.');

  if (tieneComa && tienePunto) {
    texto = texto.replace(/\./g, '').replace(',', '.');
  } else if (tieneComa) {
    texto = texto.replace(',', '.');
  } else if (tienePunto) {
    const ultimoGrupo = texto.slice(texto.lastIndexOf('.') + 1);
    if (ultimoGrupo.length === 3) texto = texto.replace(/\./g, '');
  }

  const valor = Number(texto);
  return Number.isFinite(valor) ? valor : null;
}

function parsearMontoToken(token) {
  const match = RE_MONTO.exec(token);
  if (!match) return null;

  const valor = parsearNumero(match[1]);
  if (valor === null || valor <= 0) return null;

  const escala = match[2] ? 1000 : 1;
  return roundMoney(valor * escala);
}

function parsearFechaToken(token, hoy) {
  const relativo = DIAS_RELATIVOS[token.toLowerCase()];
  if (relativo !== undefined) return formatDbDateInput(desplazarDias(hoy, relativo));

  const match = RE_FECHA_NUMERICA.exec(token);
  if (!match) return null;

  const dia = Number(match[1]);
  const mes = Number(match[2]);
  if (dia < 1 || dia > 31 || mes < 1 || mes > 12) return null;

  let anio = hoy.getUTCFullYear();
  if (match[3]) anio = match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]);

  return formatDbDateInput(utcDate(anio, mes, dia));
}

/** Reconoce "x3", "3x", "3 cuotas" y "en 3 cuotas". Devuelve cuántos tokens consumió. */
function parsearCuotasToken(token, siguiente, posterior) {
  const prefijo = RE_CUOTAS_PREFIJO.exec(token) || RE_CUOTAS_SUFIJO.exec(token);
  if (prefijo) {
    const valor = Number(prefijo[1]);
    if (valor >= 1 && valor <= 48) return { valor, consumidos: 1 };
    return null;
  }

  if (/^en$/i.test(token) && /^\d{1,2}$/.test(siguiente || '') && RE_PALABRA_CUOTAS.test(posterior || '')) {
    const valor = Number(siguiente);
    if (valor >= 1 && valor <= 48) return { valor, consumidos: 3 };
  }

  if (/^\d{1,2}$/.test(token) && RE_PALABRA_CUOTAS.test(siguiente || '')) {
    const valor = Number(token);
    if (valor >= 1 && valor <= 48) return { valor, consumidos: 2 };
  }

  return null;
}

/**
 * Convierte un mensaje suelto ("1500 super x3", "+ 250000 sueldo") en un borrador.
 * Devuelve { error } cuando no encuentra un monto usable.
 */
function parsearEntrada(entrada) {
  const crudo = String(entrada || '').trim();
  if (!crudo) return { error: 'Mandame al menos un monto, por ejemplo: 1500 super' };

  let tipo = 'gasto';
  let texto = crudo;
  if (texto.startsWith('+')) {
    tipo = 'ingreso';
    texto = texto.slice(1).trim();
  } else if (texto.startsWith('-')) {
    texto = texto.slice(1).trim();
  }

  const hoy = utcToday();
  const tokens = texto.split(/\s+/).filter(Boolean);

  let monto = null;
  let fecha = null;
  let cuotas = null;
  const resto = [];

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];

    if (fecha === null) {
      const posibleFecha = parsearFechaToken(token, hoy);
      if (posibleFecha) {
        fecha = posibleFecha;
        continue;
      }
    }

    if (cuotas === null) {
      const posibleCuotas = parsearCuotasToken(token, tokens[i + 1], tokens[i + 2]);
      if (posibleCuotas) {
        cuotas = posibleCuotas.valor;
        i += posibleCuotas.consumidos - 1;
        continue;
      }
    }

    if (monto === null) {
      const posibleMonto = parsearMontoToken(token);
      if (posibleMonto !== null) {
        monto = posibleMonto;
        continue;
      }
    }

    resto.push(token);
  }

  if (monto === null) {
    return { error: 'No encontré el monto. Probá con algo como: 1500 super' };
  }

  return {
    tipo,
    monto,
    descripcion: resto.join(' ').trim(),
    fecha: fecha || formatDbDateInput(hoy),
    cuotas,
  };
}

module.exports = { parsearEntrada, parsearNumero, parsearMontoToken };
