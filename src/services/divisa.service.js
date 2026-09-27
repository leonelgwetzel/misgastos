const { z } = require('zod');
const prisma = require('../lib/prisma');
const { convertToPrincipal } = require('../lib/money');

const divisaSchema = z.object({
  codigo: z.string().min(2).max(6).transform((v) => v.toUpperCase()),
  simbolo: z.string().min(1).max(8),
  nombre: z.string().min(1).max(80),
});

const tarifaSchema = z.object({
  divisaId: z.string().min(1),
  tasa: z.coerce.number().positive('La tasa debe ser positiva'),
});

async function syncHistorialTarifas(userId) {
  const actuales = await prisma.tarifaCambioDefault.findMany({
    where: { usuarioId: userId },
  });
  if (actuales.length === 0) return;

  const previos = await prisma.historialTarifaCambio.findMany({
    where: { usuarioId: userId },
    orderBy: { createdAt: 'desc' },
  });
  const ultimaPorDivisa = new Map();
  previos.forEach((h) => {
    if (!ultimaPorDivisa.has(h.divisaId)) ultimaPorDivisa.set(h.divisaId, h);
  });

  const faltantes = actuales.filter((t) => {
    const last = ultimaPorDivisa.get(t.divisaId);
    return !last || Number(last.tasa) !== Number(t.tasa);
  });

  if (faltantes.length === 0) return;

  await prisma.historialTarifaCambio.createMany({
    data: faltantes.map((t) => ({
      usuarioId: userId,
      divisaId: t.divisaId,
      tasa: t.tasa,
      createdAt: t.updatedAt,
    })),
  });
}

async function listByUser(userId) {
  await syncHistorialTarifas(userId);

  const [divisas, historial] = await Promise.all([
    prisma.divisa.findMany({
      where: { usuarioId: userId },
      orderBy: { codigo: 'asc' },
      include: {
        tarifasDefault: {
          where: { usuarioId: userId },
        },
      },
    }),
    prisma.historialTarifaCambio.findMany({
      where: { usuarioId: userId },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const logsPorDivisa = historial.reduce((acc, row) => {
    (acc[row.divisaId] || (acc[row.divisaId] = [])).push(row);
    return acc;
  }, {});

  return divisas.map((d) => ({
    ...d,
    historialTarifas: logsPorDivisa[d.id] || [],
  }));
}

async function getTasaForDivisa(userId, divisaId) {
  const usuario = await prisma.usuario.findUnique({
    where: { id: userId },
    include: { divisaPrincipal: true },
  });

  const divisa = await prisma.divisa.findFirst({
    where: { id: divisaId, usuarioId: userId },
  });

  if (!divisa) throw new Error('Divisa no encontrada');

  if (usuario.divisaPrincipalId === divisaId) {
    return 1;
  }

  const tarifa = await prisma.tarifaCambioDefault.findUnique({
    where: {
      usuarioId_divisaId: { usuarioId: userId, divisaId },
    },
  });

  return tarifa ? Number(tarifa.tasa) : 1;
}

async function resolveMontoPrincipal(userId, divisaId, montoOriginal, tasaOverride) {
  const tasa = tasaOverride != null
    ? Number(tasaOverride)
    : await getTasaForDivisa(userId, divisaId);

  return {
    tasaConversion: tasa,
    montoPrincipal: convertToPrincipal(montoOriginal, tasa),
  };
}

async function createDivisa(userId, rawData) {
  const parsed = divisaSchema.parse(rawData);

  const existing = await prisma.divisa.findFirst({
    where: { usuarioId: userId, codigo: parsed.codigo },
  });
  if (existing) throw new Error('Ya tenés esa divisa');

  return prisma.divisa.create({
    data: {
      usuarioId: userId,
      codigo: parsed.codigo,
      simbolo: parsed.simbolo,
      nombre: parsed.nombre,
    },
  });
}

async function upsertTarifa(userId, rawData) {
  const parsed = tarifaSchema.parse(rawData);

  const usuario = await prisma.usuario.findUnique({ where: { id: userId } });
  if (usuario.divisaPrincipalId === parsed.divisaId) {
    throw new Error('No se configura tasa para la divisa principal');
  }

  const divisa = await prisma.divisa.findFirst({
    where: { id: parsed.divisaId, usuarioId: userId },
  });
  if (!divisa) throw new Error('Divisa no encontrada');

  const tarifa = await prisma.tarifaCambioDefault.upsert({
    where: {
      usuarioId_divisaId: { usuarioId: userId, divisaId: parsed.divisaId },
    },
    create: {
      usuarioId: userId,
      divisaId: parsed.divisaId,
      tasa: parsed.tasa,
    },
    update: {
      tasa: parsed.tasa,
    },
  });

  await prisma.historialTarifaCambio.create({
    data: {
      usuarioId: userId,
      divisaId: parsed.divisaId,
      tasa: parsed.tasa,
    },
  });

  return tarifa;
}

module.exports = {
  divisaSchema,
  tarifaSchema,
  listByUser,
  getTasaForDivisa,
  resolveMontoPrincipal,
  createDivisa,
  upsertTarifa,
};
