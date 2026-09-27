const ingresoFijoService = require('../services/ingresoFijo.service');
const cuentaService = require('../services/cuenta.service');
const categoriaService = require('../services/categoria.service');
const { currentMonthKey } = require('../lib/dates');

async function loadFormData(userId) {
  const [ingresosFijos, cuentas, categorias] = await Promise.all([
    ingresoFijoService.listByUser(userId),
    cuentaService.listByUser(userId),
    categoriaService.listByUser(userId),
  ]);
  return { ingresosFijos, cuentas, categorias };
}

async function list(req, res) {
  const data = await loadFormData(req.session.userId);
  const mesActual = currentMonthKey();

  res.render('ingresos-fijos/index', {
    title: 'Ingresos fijos',
    ...data,
    mesActual,
    errors: {},
    values: {
      diaDelMes: 1,
      vigenteDesde: `${mesActual}-01`,
    },
    success: req.query.success || null,
    error: req.query.error || null,
  });
}

async function create(req, res) {
  try {
    await ingresoFijoService.create(req.session.userId, req.body);
    return res.redirect('/ingresos-fijos?success=creado');
  } catch (err) {
    const data = await loadFormData(req.session.userId);
    const errors = err.issues
      ? Object.fromEntries(err.issues.map((e) => [e.path[0], e.message]))
      : { general: err.message };

    return res.status(400).render('ingresos-fijos/index', {
      title: 'Ingresos fijos',
      ...data,
      mesActual: currentMonthKey(),
      errors,
      values: req.body,
      success: null,
      error: null,
    });
  }
}

async function addHistorial(req, res) {
  try {
    await ingresoFijoService.addHistorial(req.session.userId, req.params.id, req.body);
    return res.redirect('/ingresos-fijos?success=historial');
  } catch (err) {
    const msg = err.message || 'Error';
    return res.redirect(`/ingresos-fijos?error=${encodeURIComponent(msg)}`);
  }
}

async function setOverride(req, res) {
  try {
    await ingresoFijoService.setMesOverride(req.session.userId, req.params.id, req.body);
    return res.redirect('/ingresos-fijos?success=override');
  } catch (err) {
    return res.redirect(`/ingresos-fijos?error=${encodeURIComponent(err.message)}`);
  }
}

async function remove(req, res) {
  try {
    await ingresoFijoService.deactivate(req.session.userId, req.params.id);
    res.redirect('/ingresos-fijos?success=desactivado');
  } catch (err) {
    res.redirect(`/ingresos-fijos?error=${encodeURIComponent(err.message)}`);
  }
}

module.exports = { list, create, addHistorial, setOverride, remove };
