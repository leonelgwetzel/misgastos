const crypto = require('crypto');
const prisma = require('../lib/prisma');

let botUsernameCache = null;

function usernameDesdeEnv() {
  return String(process.env.TELEGRAM_BOT_USERNAME || '').trim().replace(/^@/, '');
}

/** Usuario público del bot, para armar https://t.me/…. */
async function getBotUsername() {
  const desdeEnv = usernameDesdeEnv();
  if (desdeEnv) return desdeEnv;
  if (botUsernameCache) return botUsernameCache;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;

  try {
    const respuesta = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await respuesta.json();
    const username = data && data.ok && data.result ? data.result.username : '';
    if (!username) return null;
    botUsernameCache = username;
    return username;
  } catch (err) {
    return null;
  }
}

function urlDelBot(username, codigo) {
  if (!username) return null;
  const base = `https://t.me/${username}`;
  const limpio = normalizarCodigo(codigo);
  if (limpio.length !== CODIGO_LENGTH) return base;
  return `${base}?start=${limpio}`;
}

const CODIGO_LENGTH = 6;
const CODIGO_TTL_MINUTOS = 15;
/** Sin I, O, 0 ni 1 para que el código sea fácil de tipear en el celular. */
const CODIGO_ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generarCodigo() {
  const bytes = crypto.randomBytes(CODIGO_LENGTH);
  let codigo = '';
  for (let i = 0; i < CODIGO_LENGTH; i += 1) {
    codigo += CODIGO_ALFABETO[bytes[i] % CODIGO_ALFABETO.length];
  }
  return codigo;
}

function normalizarCodigo(valor) {
  return String(valor || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Genera un código de vinculación de un solo uso. Descarta los pendientes
 * previos del usuario para que solo haya un código válido a la vez.
 */
async function crearCodigo(userId) {
  await prisma.telegramVinculo.deleteMany({
    where: { usuarioId: userId, vinculadoEn: null },
  });

  const expiraEn = new Date(Date.now() + CODIGO_TTL_MINUTOS * 60 * 1000);

  for (let intento = 0; intento < 5; intento += 1) {
    const codigo = generarCodigo();
    try {
      return await prisma.telegramVinculo.create({
        data: { usuarioId: userId, codigo, expiraEn },
      });
    } catch (err) {
      if (err.code !== 'P2002') throw err;
    }
  }

  throw new Error('No se pudo generar un código de vinculación. Probá de nuevo.');
}

/** Canjea un código por un vínculo activo contra el chat que lo envió. */
async function vincular(codigoRaw, chatId, alias) {
  const codigo = normalizarCodigo(codigoRaw);
  if (codigo.length !== CODIGO_LENGTH) {
    throw new Error('El código tiene 6 caracteres. Revisalo y probá de nuevo.');
  }

  const pendiente = await prisma.telegramVinculo.findUnique({
    where: { codigo },
    include: { usuario: true },
  });

  if (!pendiente || pendiente.vinculadoEn) {
    throw new Error('Ese código no existe o ya fue usado. Generá uno nuevo desde Configuración.');
  }
  if (pendiente.expiraEn < new Date()) {
    await prisma.telegramVinculo.delete({ where: { id: pendiente.id } });
    throw new Error('El código venció. Generá uno nuevo desde Configuración.');
  }

  const chatIdBig = BigInt(chatId);

  return prisma.$transaction(async (tx) => {
    await tx.telegramVinculo.deleteMany({
      where: { chatId: chatIdBig, NOT: { id: pendiente.id } },
    });

    return tx.telegramVinculo.update({
      where: { id: pendiente.id },
      data: { chatId: chatIdBig, alias: alias || null, vinculadoEn: new Date() },
      include: { usuario: true },
    });
  });
}

/** Devuelve el usuario dueño de un chat, o null si el chat no está vinculado. */
async function resolverUsuario(chatId) {
  const vinculo = await prisma.telegramVinculo.findUnique({
    where: { chatId: BigInt(chatId) },
    include: { usuario: { include: { divisaPrincipal: true } } },
  });

  if (!vinculo || !vinculo.vinculadoEn) return null;
  return vinculo.usuario;
}

async function desvincularPorChat(chatId) {
  const { count } = await prisma.telegramVinculo.deleteMany({
    where: { chatId: BigInt(chatId) },
  });
  return count > 0;
}

async function desvincularPorId(userId, vinculoId) {
  const { count } = await prisma.telegramVinculo.deleteMany({
    where: { id: vinculoId, usuarioId: userId },
  });
  if (count === 0) throw new Error('Vínculo no encontrado');
  return count;
}

/** Estado de Telegram para mostrar en Configuración. */
async function getEstado(userId) {
  const vinculos = await prisma.telegramVinculo.findMany({
    where: { usuarioId: userId },
    orderBy: { createdAt: 'desc' },
  });

  const ahora = new Date();
  const activos = vinculos
    .filter((v) => v.vinculadoEn)
    .map((v) => ({
      id: v.id,
      alias: v.alias || 'Chat de Telegram',
      vinculadoEn: v.vinculadoEn,
    }));

  const pendienteRaw = vinculos.find((v) => !v.vinculadoEn && v.expiraEn > ahora);
  const pendiente = pendienteRaw
    ? {
      codigo: pendienteRaw.codigo,
      expiraEn: pendienteRaw.expiraEn,
      minutosRestantes: Math.max(1, Math.ceil((pendienteRaw.expiraEn - ahora) / 60000)),
    }
    : null;

  const username = await getBotUsername();

  return {
    activos,
    pendiente,
    botUsername: username,
    botUrl: urlDelBot(username, pendiente && pendiente.codigo),
    configurado: Boolean(process.env.TELEGRAM_BOT_TOKEN),
  };
}

module.exports = {
  CODIGO_TTL_MINUTOS,
  crearCodigo,
  vincular,
  resolverUsuario,
  desvincularPorChat,
  desvincularPorId,
  getBotUsername,
  urlDelBot,
  getEstado,
};
