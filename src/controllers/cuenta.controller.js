const cuentaService = require('../services/cuenta.service');
const movimientoService = require('../services/movimiento.service');
const prisma = require('../lib/prisma');

async function list(req, res) {
  const [cuentas, divisas] = await Promise.all([
    cuentaService.listByUser(req.session.userId),
    prisma.divisa.findMany({
      where: { usuarioId: req.session.userId },
      orderBy: { codigo: 'asc' },
    }),
  ]);

  const today = new Date();
  const fechaHoy = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  res.render('cuentas/index', {
    title: 'Cuentas',
    cuentas,
    divisas,
    errors: {},
    values: { tipo: 'BANCO', saldoInicial: 0 },
    success: req.query.success || null,
  });
}

async function create(req, res) {
  const divisas = await prisma.divisa.findMany({
    where: { usuarioId: req.session.userId },
  });

  try {
    await cuentaService.create(req.session.userId, req.body);
    return res.redirect('/cuentas?success=creada');
  } catch (err) {
    const errors = err.issues
      ? Object.fromEntries(err.issues.map((e) => [e.path[0], e.message]))
      : { general: err.message };

    const cuentas = await cuentaService.listByUser(req.session.userId);
    return res.status(400).render('cuentas/index', {
      title: 'Cuentas',
      cuentas,
      divisas,
      errors,
      values: req.body,
      success: null,
    });
  }
}

async function movimientos(req, res) {
  const cuentaId = req.params.id;
  const cuenta = await cuentaService.getForUser(cuentaId, req.session.userId);
  const movimientos = await movimientoService.listByCuenta(req.session.userId, cuentaId);
  const categorias = await prisma.categoria.findMany({
    where: { usuarioId: req.session.userId },
    orderBy: { nombre: 'asc' },
  });

  const today = new Date();
  const fechaHoy = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  res.render('cuentas/movimientos', {
    title: cuenta.nombre,
    cuenta,
    movimientos,
    categorias,
    errors: {},
    values: { fecha: fechaHoy, tipo: 'INGRESO' },
    success: req.query.success || null,
  });
}

async function createMovimiento(req, res) {
  const cuentaId = req.params.id;

  try {
    await movimientoService.createMovimiento(req.session.userId, cuentaId, req.body);
    return res.redirect(`/cuentas/${cuentaId}/movimientos?success=movimiento`);
  } catch (err) {
    const cuenta = await cuentaService.getForUser(cuentaId, req.session.userId);
    const movimientos = await movimientoService.listByCuenta(req.session.userId, cuentaId);
    const categorias = await prisma.categoria.findMany({
      where: { usuarioId: req.session.userId },
    });

    const errors = err.issues
      ? Object.fromEntries(err.issues.map((e) => [e.path[0], e.message]))
      : { general: err.message };

    return res.status(400).render('cuentas/movimientos', {
      title: cuenta.nombre,
      cuenta,
      movimientos,
      categorias,
      errors,
      values: req.body,
      success: null,
    });
  }
}

async function ajustar(req, res) {
  const cuentaId = req.params.id;

  try {
    await movimientoService.ajustarSaldo(req.session.userId, cuentaId, req.body);
    return res.redirect(`/cuentas/${cuentaId}/movimientos?success=ajuste`);
  } catch (err) {
    const errors = err.issues
      ? Object.fromEntries(err.issues.map((e) => [e.path[0], e.message]))
      : { general: err.message };
    return res.redirect(`/cuentas/${cuentaId}/movimientos?error=${encodeURIComponent(errors.general || 'Error')}`);
  }
}

async function remove(req, res) {
  try {
    await cuentaService.deactivate(req.session.userId, req.params.id);
    res.redirect('/cuentas?success=eliminada');
  } catch (err) {
    res.redirect(`/cuentas?error=${encodeURIComponent(err.message)}`);
  }
}

module.exports = {
  list,
  create,
  movimientos,
  createMovimiento,
  ajustar,
  remove,
};
