const { z } = require('zod');
const prisma = require('../lib/prisma');
const authService = require('./auth.service');

const createSchema = z.object({
  nombre: z.string().min(2, 'Nombre muy corto').max(100),
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  perfil: z.enum(['admin', 'cliente']),
});

const updateSchema = z.object({
  nombre: z.string().min(2, 'Nombre muy corto').max(100),
  email: z.string().email('Email inválido'),
  password: z.string().optional(),
  perfil: z.enum(['admin', 'cliente']),
}).refine((data) => !data.password || data.password.length >= 8, {
  message: 'Mínimo 8 caracteres',
  path: ['password'],
});

function isChecked(value) {
  return value === true || value === 'on' || value === 'true' || value === '1';
}

async function listAll() {
  return prisma.usuario.findMany({
    orderBy: [{ habilitado: 'asc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      email: true,
      nombre: true,
      perfil: true,
      habilitado: true,
      createdAt: true,
    },
  });
}

async function getById(id) {
  const usuario = await prisma.usuario.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      nombre: true,
      perfil: true,
      habilitado: true,
      createdAt: true,
    },
  });
  if (!usuario) {
    const err = new Error('Usuario no encontrado');
    err.status = 404;
    throw err;
  }
  return usuario;
}

async function countAdminsHabilitados(exceptId) {
  return prisma.usuario.count({
    where: {
      perfil: 'admin',
      habilitado: true,
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
  });
}

async function create(body) {
  const parsed = createSchema.parse({
    nombre: body.nombre,
    email: body.email,
    password: body.password,
    perfil: body.perfil || 'cliente',
  });
  const result = await authService.register({
    ...parsed,
    habilitado: isChecked(body.habilitado),
  });
  if (result.error) {
    const err = new Error(result.error);
    err.status = 400;
    throw err;
  }
  return result.usuario;
}

async function update(id, body, actorId) {
  const parsed = updateSchema.parse({
    nombre: body.nombre,
    email: body.email,
    password: body.password || undefined,
    perfil: body.perfil || 'cliente',
  });
  const current = await getById(id);
  const habilitado = isChecked(body.habilitado);

  if (current.perfil === 'admin' && (parsed.perfil !== 'admin' || !habilitado)) {
    const others = await countAdminsHabilitados(id);
    if (others < 1) {
      throw new Error('Tiene que quedar al menos un admin habilitado');
    }
  }
  if (id === actorId && parsed.perfil !== 'admin') {
    throw new Error('No podés quitarte el perfil admin');
  }

  const data = {
    nombre: parsed.nombre,
    email: parsed.email,
    perfil: parsed.perfil,
    habilitado,
  };

  if (parsed.password) {
    const bcrypt = require('bcrypt');
    data.passwordHash = await bcrypt.hash(parsed.password, 12);
  }

  try {
    return await prisma.usuario.update({ where: { id }, data });
  } catch (err) {
    if (err.code === 'P2002') {
      const clash = new Error('Ya existe una cuenta con ese email');
      clash.status = 400;
      throw clash;
    }
    throw err;
  }
}

async function setHabilitado(id, habilitado, actorId) {
  if (id === actorId) {
    throw new Error('No podés cambiar el estado de tu propio acceso');
  }
  const current = await getById(id);
  if (current.perfil === 'admin' && !habilitado) {
    const others = await countAdminsHabilitados(id);
    if (others < 1) {
      throw new Error('Tiene que quedar al menos un admin habilitado');
    }
  }
  return prisma.usuario.update({
    where: { id },
    data: { habilitado },
  });
}

async function remove(id, actorId) {
  if (id === actorId) {
    throw new Error('No podés eliminar tu usuario');
  }
  const current = await getById(id);
  if (current.habilitado) {
    throw new Error('Solo se pueden eliminar solicitudes pendientes');
  }
  return prisma.usuario.delete({ where: { id } });
}

module.exports = {
  listAll,
  getById,
  create,
  update,
  setHabilitado,
  remove,
};
