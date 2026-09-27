const cuentaService = require('../services/cuenta.service');
const movimientoService = require('../services/movimiento.service');
const prisma = require('../lib/prisma');

async function renderList(req, res, {
  errors = {},
  values = null,
  editing = null,
  status = 200,
  success = null,
} = {}) {
  const [cuentas, divisas] = await Promise.all([
    cuentaService.listByUser(req.session.userId),
    prisma.divisa.findMany({
      where: { usuarioId: req.session.userId },
      orderBy: { codigo: 'asc' },
    }),
  ]);

  return res.status(status).render('cuentas/index', {
    title: 'Cuentas',
    cuentas,
    divisas,
    editing,
    errors,
    values: values || { tipo: 'BANCO', saldoInicial: 0 },
    success: success != null ? success : (req.query.success || null),
    error: req.query.error || null,
  });
}

async function list(req, res) {
  let editing = null;
  let values = null;
  if (req.query.edit) {
    editing = await prisma.cuenta.findFirst({
      where: { id: req.query.edit, usuarioId: req.session.userId, activa: true },
      include: { divisa: true },
    });
    if (editing) {
      values = {
        nombre: editing.nombre,
        tipo: editing.tipo,
        divisaId: editing.divisaId,
      };
    }
  }
  return renderList(req, res, { editing, values });
}

async function create(req, res) {
  try {
    await cuentaService.create(req.session.userId, req.body);
    return res.redirect('/cuentas?success=creada');
  } catch (err) {
    const errors = err.issues
      ? Object.fromEntries(err.issues.map((e) => [e.path[0], e.message]))
      : { general: err.message };
    return renderList(req, res, { errors, values: req.body, status: 400 });
  }
}

async function update(req, res) {
  try {
    await cuentaService.update(req.session.userId, req.params.id, req.body);
    return res.redirect('/cuentas?success=actualizada');
  } catch (err) {
    const errors = err.issues
      ? Object.fromEntries(err.issues.map((e) => [e.path[0], e.message]))
      : { general: err.message };
    const editing = await prisma.cuenta.findFirst({
      where: { id: req.params.id, usuarioId: req.session.userId },
      include: { divisa: true },
    });
    return renderList(req, res, {
      errors,
      values: req.body,
      editing,
      status: 400,
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
    error: req.query.error || null,
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
      error: null,
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
  update,
  movimientos,
  createMovimiento,
  ajustar,
  remove,
};
