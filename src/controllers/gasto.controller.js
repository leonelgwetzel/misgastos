const gastoService = require('../services/gasto.service');
const tarjetaService = require('../services/tarjeta.service');
const cuentaService = require('../services/cuenta.service');
const prisma = require('../lib/prisma');

async function loadFormData(userId) {
  const [gastos, tarjetas, cuentas, categorias, divisas] = await Promise.all([
    gastoService.listByUser(userId),
    tarjetaService.listByUser(userId),
    cuentaService.listByUser(userId),
    prisma.categoria.findMany({
      where: { usuarioId: userId },
      orderBy: { nombre: 'asc' },
    }),
    prisma.divisa.findMany({
      where: { usuarioId: userId },
      orderBy: { codigo: 'asc' },
    }),
  ]);
  return { gastos, tarjetas, cuentas, categorias, divisas };
}

async function list(req, res) {
  const data = await loadFormData(req.session.userId);
  const today = new Date();
  const fechaHoy = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  res.render('gastos/index', {
    title: 'Gastos',
    ...data,
    errors: {},
    values: {
      fechaCompra: fechaHoy,
      cantidadCuotas: 1,
      medioPago: 'TARJETA',
    },
    success: req.query.success || null,
  });
}

async function create(req, res) {
  const medioPago = req.body.medioPago || 'TARJETA';

  try {
    if (medioPago === 'TARJETA') {
      await gastoService.createTarjetaGasto(req.session.userId, req.body);
    } else {
      await gastoService.createEfectivoDebitoGasto(req.session.userId, {
        ...req.body,
        medioPago,
      });
    }
    return res.redirect('/gastos?success=creado');
  } catch (err) {
    const data = await loadFormData(req.session.userId);
    const errors = err.issues
      ? Object.fromEntries(err.issues.map((e) => [e.path[0], e.message]))
      : { general: err.message };

    return res.status(400).render('gastos/index', {
      title: 'Gastos',
      ...data,
      errors,
      values: req.body,
      success: null,
    });
  }
}

module.exports = { list, create };
