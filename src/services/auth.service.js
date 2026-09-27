const bcrypt = require('bcrypt');
const { z } = require('zod');
const prisma = require('../lib/prisma');

const SALT_ROUNDS = 12;

const registerSchema = z.object({
  nombre: z.string().min(2, 'Nombre muy corto').max(100),
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  passwordConfirm: z.string(),
}).refine((data) => data.password === data.passwordConfirm, {
  message: 'Las contraseñas no coinciden',
  path: ['passwordConfirm'],
});

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Ingresá tu contraseña'),
});

const DIVISAS_INICIALES = [
  { codigo: 'ARS', simbolo: '$', nombre: 'Peso argentino' },
  { codigo: 'USD', simbolo: 'U$S', nombre: 'Dólar estadounidense' },
];

async function register({ nombre, email, password, perfil = 'cliente', habilitado = false }) {
  const existing = await prisma.usuario.findUnique({ where: { email } });
  if (existing) {
    return { error: 'Ya existe una cuenta con ese email' };
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const usuario = await prisma.$transaction(async (tx) => {
    const user = await tx.usuario.create({
      data: { nombre, email, passwordHash, perfil, habilitado },
    });

    const divisas = [];
    for (const d of DIVISAS_INICIALES) {
      const divisa = await tx.divisa.create({
        data: { usuarioId: user.id, ...d },
      });
      divisas.push(divisa);
    }

    const ars = divisas.find((d) => d.codigo === 'ARS');
    const usd = divisas.find((d) => d.codigo === 'USD');

    await tx.usuario.update({
      where: { id: user.id },
      data: { divisaPrincipalId: ars.id },
    });

    if (usd) {
      await tx.tarifaCambioDefault.create({
        data: {
          usuarioId: user.id,
          divisaId: usd.id,
          tasa: 1000,
        },
      });
    }

    const categorias = ['Comida', 'Transporte', 'Salud', 'Vivienda', 'Ocio', 'Otros'];
    for (const nombreCat of categorias) {
      await tx.categoria.create({
        data: { usuarioId: user.id, nombre: nombreCat, esSistema: true },
      });
    }

    return { ...user, divisaPrincipalId: ars.id };
  });

  return { usuario };
}

async function login({ email, password }) {
  const usuario = await prisma.usuario.findUnique({
    where: { email },
    include: { divisaPrincipal: true },
  });

  if (!usuario) {
    return { error: 'Email o contraseña incorrectos' };
  }

  const valid = await bcrypt.compare(password, usuario.passwordHash);
  if (!valid) {
    return { error: 'Email o contraseña incorrectos' };
  }

  if (!usuario.habilitado) {
    return { error: 'Tu acceso todavía no fue habilitado' };
  }

  return {
    usuario: {
      id: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      perfil: usuario.perfil,
      habilitado: usuario.habilitado,
      divisaPrincipal: usuario.divisaPrincipal,
    },
  };
}

function toSessionUser(usuario) {
  return {
    id: usuario.id,
    email: usuario.email,
    nombre: usuario.nombre,
    perfil: usuario.perfil || 'cliente',
    habilitado: usuario.habilitado !== false,
    divisaPrincipal: usuario.divisaPrincipal
      ? { codigo: usuario.divisaPrincipal.codigo, simbolo: usuario.divisaPrincipal.simbolo }
      : { codigo: 'ARS', simbolo: '$' },
  };
}

module.exports = {
  registerSchema,
  loginSchema,
  register,
  login,
  toSessionUser,
};
