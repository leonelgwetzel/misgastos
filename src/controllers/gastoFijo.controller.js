const gastoFijoService = require('../services/gastoFijo.service');
const tarjetaService = require('../services/tarjeta.service');
const cuentaService = require('../services/cuenta.service');
const prisma = require('../lib/prisma');

async function loadFormData(userId) {
  const [gastosFijos, tarjetas, cuentas, divisas, tiposGasto] = await Promise.all([
    gastoFijoService.listByUser(userId),
    tarjetaService.listByUser(userId),
    cuentaService.listByUser(userId),
    prisma.divisa.findMany({ where: { usuarioId: userId }, orderBy: { codigo: 'asc' } }),
    prisma.tipoGasto.findMany({ where: { usuarioId: userId }, orderBy: { nombre: 'asc' } }),
  ]);
  return { gastosFijos, tarjetas, cuentas, divisas, tiposGasto };
}

async function list(req, res) {
  const data = await loadFormData(req.session.userId);
  const today = new Date();
  const mesActual = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  res.render('gastos-fijos/index', {
    title: 'Gastos fijos',
    ...data,
    errors: {},
    values: {
      medioPago: 'TARJETA',
      diaDelMes: 1,
      vigenteDesde: `${mesActual}-01`,
    },
    success: req.query.success || null,
  });
}

async function create(req, res) {
  try {
    await gastoFijoService.create(req.session.userId, req.body);
    return res.redirect('/gastos-fijos?success=creado');
  } catch (err) {
    const data = await loadFormData(req.session.userId);
    const errors = err.issues
      ? Object.fromEntries(err.issues.map((e) => [e.path[0], e.message]))
      : { general: err.message };

    return res.status(400).render('gastos-fijos/index', {
      title: 'Gastos fijos',
      ...data,
      errors,
      values: req.body,
      success: null,
    });
  }
}

async function addHistorial(req, res) {
  try {
    await gastoFijoService.addHistorial(req.session.userId, req.params.id, req.body);
    return res.redirect('/gastos-fijos?success=historial');
  } catch (err) {
    const msg = err.message || 'Error';
    return res.redirect(`/gastos-fijos?error=${encodeURIComponent(msg)}`);
  }
}

async function setOverride(req, res) {
  try {
    await gastoFijoService.setMesOverride(req.session.userId, req.params.id, {
      ...req.body,
      omitido: req.body.omitido === 'on' || req.body.omitido === 'true',
    });
    return res.redirect('/gastos-fijos?success=override');
  } catch (err) {
    return res.redirect(`/gastos-fijos?error=${encodeURIComponent(err.message)}`);
  }
}

async function remove(req, res) {
  try {
    await gastoFijoService.deactivate(req.session.userId, req.params.id);
    res.redirect('/gastos-fijos?success=desactivado');
  } catch (err) {
    res.redirect(`/gastos-fijos?error=${encodeURIComponent(err.message)}`);
  }
}

module.exports = { list, create, addHistorial, setOverride, remove };
