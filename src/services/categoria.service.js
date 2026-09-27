const { z } = require('zod');
const prisma = require('../lib/prisma');
const { esIconoValido, esColorValido, resolverEstilo } = require('../lib/categoriaEstilo');

const categoriaSchema = z.object({
  nombre: z.string().trim().min(1, 'Nombre requerido').max(40, 'Máximo 40 caracteres'),
  icono: z.string().trim().optional()
    .refine((v) => !v || esIconoValido(v), 'Ícono inválido'),
  color: z.string().trim().optional()
    .refine((v) => !v || esColorValido(v), 'Color inválido'),
});

async function listByUser(userId) {
  const categorias = await prisma.categoria.findMany({
    where: { usuarioId: userId },
    orderBy: { nombre: 'asc' },
    include: {
      _count: {
        select: {
          gastos: true,
          movimientos: true,
          ingresosFijos: true,
        },
      },
    },
  });

  return categorias.map((c) => ({
    ...c,
    ...resolverEstilo(c),
    usos: c._count.gastos + c._count.movimientos + c._count.ingresosFijos,
  }));
}

/** Mapa nombre → estilo, para pintar los gráficos del mes. */
async function estiloPorNombre(userId) {
  const categorias = await prisma.categoria.findMany({
    where: { usuarioId: userId },
    select: { nombre: true, icono: true, color: true },
  });

  const mapa = new Map();
  for (const categoria of categorias) {
    mapa.set(categoria.nombre, resolverEstilo(categoria));
  }
  return mapa;
}

async function getForUser(userId, categoriaId) {
  const categoria = await prisma.categoria.findFirst({
    where: { id: categoriaId, usuarioId: userId },
  });
  if (!categoria) throw new Error('Categoría no encontrada');
  return categoria;
}

async function create(userId, rawData) {
  const parsed = categoriaSchema.parse(rawData);
  try {
    return await prisma.categoria.create({
      data: {
        usuarioId: userId,
        nombre: parsed.nombre,
        icono: parsed.icono || null,
        color: parsed.color || null,
        esSistema: false,
      },
    });
  } catch (err) {
    if (err.code === 'P2002') throw new Error('Ya existe una categoría con ese nombre.');
    throw err;
  }
}

async function update(userId, categoriaId, rawData) {
  const parsed = categoriaSchema.parse(rawData);
  await getForUser(userId, categoriaId);
  try {
    return await prisma.categoria.update({
      where: { id: categoriaId },
      data: {
        nombre: parsed.nombre,
        icono: parsed.icono || null,
        color: parsed.color || null,
      },
    });
  } catch (err) {
    if (err.code === 'P2002') throw new Error('Ya existe una categoría con ese nombre.');
    throw err;
  }
}

async function remove(userId, categoriaId) {
  await getForUser(userId, categoriaId);
  return prisma.categoria.delete({ where: { id: categoriaId } });
}

module.exports = {
  categoriaSchema,
  listByUser,
  estiloPorNombre,
  getForUser,
  create,
  update,
  remove,
};
