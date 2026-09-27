const { z } = require('zod');
const prisma = require('../lib/prisma');
const { roundMoney } = require('../lib/money');

const cuentaSchema = z.object({
  nombre: z.string().min(1, 'Nombre requerido').max(80),
  tipo: z.enum(['BANCO', 'BILLETERA', 'EFECTIVO']),
  divisaId: z.string().min(1),
  saldoInicial: z.coerce.number().default(0),
});

async function getForUser(cuentaId, userId) {
  const cuenta = await prisma.cuenta.findFirst({
    where: { id: cuentaId, usuarioId: userId, activa: true },
    include: { divisa: true },
  });
  if (!cuenta) throw new Error('Cuenta no encontrada');
  return cuenta;
}

async function listByUser(userId) {
  return prisma.cuenta.findMany({
    where: { usuarioId: userId, activa: true },
    include: { divisa: true },
    orderBy: { nombre: 'asc' },
  });
}

async function create(userId, data) {
  const parsed = cuentaSchema.parse(data);

  const divisa = await prisma.divisa.findFirst({
    where: { id: parsed.divisaId, usuarioId: userId },
  });
  if (!divisa) throw new Error('Divisa inválida');

  const saldo = roundMoney(parsed.saldoInicial);

  return prisma.cuenta.create({
    data: {
      usuarioId: userId,
      nombre: parsed.nombre,
      tipo: parsed.tipo,
      divisaId: parsed.divisaId,
      saldoInicial: saldo,
      saldoActual: saldo,
    },
    include: { divisa: true },
  });
}

async function update(userId, cuentaId, data) {
  const parsed = z.object({
    nombre: z.string().min(1, 'Nombre requerido').max(80),
    tipo: z.enum(['BANCO', 'BILLETERA', 'EFECTIVO']).optional(),
  }).parse(data);

  await getForUser(cuentaId, userId);

  return prisma.cuenta.update({
    where: { id: cuentaId },
    data: {
      nombre: parsed.nombre,
      ...(parsed.tipo ? { tipo: parsed.tipo } : {}),
    },
    include: { divisa: true },
  });
}

async function deactivate(userId, cuentaId) {
  await getForUser(cuentaId, userId);
  return prisma.cuenta.update({
    where: { id: cuentaId },
    data: { activa: false },
  });
}

async function saldoAtDate(cuenta, endDate) {
  const movimientos = await prisma.movimiento.findMany({
    where: {
      cuentaId: cuenta.id,
      fecha: { lte: endDate },
    },
    orderBy: [{ fecha: 'asc' }, { createdAt: 'asc' }],
  });

  let saldo = Number(cuenta.saldoInicial);
  for (const mov of movimientos) {
    saldo = applyMovimientoToSaldo(saldo, mov);
  }
  return roundMoney(saldo);
}

function applyMovimientoToSaldo(saldo, movimiento) {
  const monto = Number(movimiento.monto);
  if (movimiento.tipo === 'INGRESO') return roundMoney(saldo + monto);
  if (movimiento.tipo === 'EGRESO') return roundMoney(saldo - monto);
  if (movimiento.tipo === 'AJUSTE') return roundMoney(saldo + monto);
  return saldo;
}

module.exports = {
  cuentaSchema,
  getForUser,
  listByUser,
  create,
  update,
  deactivate,
  saldoAtDate,
  applyMovimientoToSaldo,
};
