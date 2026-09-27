const tarjetaService = require('../services/tarjeta.service');
const prisma = require('../lib/prisma');

async function renderPage(req, res, {
  errors = {},
  values = null,
  editing = null,
  status = 200,
  success = null,
} = {}) {
  const tarjetas = await tarjetaService.listByUser(req.session.userId);
  const divisas = await prisma.divisa.findMany({
    where: { usuarioId: req.session.userId },
    orderBy: { codigo: 'asc' },
  });

  return res.status(status).render('tarjetas/index', {
    title: 'Tarjetas',
    tarjetas,
    divisas,
    editing,
    errors,
    values: values || {
      defaultCierreDia: 25,
      defaultVencimientoMes: 1,
      titularidad: 'PROPIA',
    },
    success: success != null ? success : (req.query.success || null),
    error: req.query.error || null,
  });
}

async function list(req, res) {
  let editing = null;
  let values = null;
  if (req.query.edit) {
    editing = await prisma.tarjeta.findFirst({
      where: { id: req.query.edit, usuarioId: req.session.userId, activa: true },
      include: { divisa: true },
    });
    if (editing) {
      values = {
        alias: editing.alias,
        banco: editing.banco || '',
        titularidad: editing.titularidad,
        defaultCierreDia: editing.defaultCierreDia,
        defaultVencimientoMes: editing.defaultVencimientoMes,
        divisaId: editing.divisaId,
      };
    }
  }
  return renderPage(req, res, { editing, values });
}

async function create(req, res) {
  try {
    await tarjetaService.create(req.session.userId, req.body);
    return res.redirect('/tarjetas?success=creada');
  } catch (err) {
    const errors = err.issues
      ? Object.fromEntries(err.issues.map((e) => [e.path[0], e.message]))
      : { general: err.message };
    return renderPage(req, res, { errors, values: req.body, status: 400 });
  }
}

async function update(req, res) {
  try {
    await tarjetaService.update(req.session.userId, req.params.id, req.body);
    return res.redirect('/tarjetas?success=actualizada');
  } catch (err) {
    const errors = err.issues
      ? Object.fromEntries(err.issues.map((e) => [e.path[0], e.message]))
      : { general: err.message };
    const editing = await prisma.tarjeta.findFirst({
      where: { id: req.params.id, usuarioId: req.session.userId },
      include: { divisa: true },
    });
    return renderPage(req, res, {
      errors,
      values: req.body,
      editing,
      status: 400,
    });
  }
}

async function remove(req, res) {
  try {
    await tarjetaService.deactivate(req.session.userId, req.params.id);
    res.redirect('/tarjetas?success=eliminada');
  } catch (err) {
    res.redirect(`/tarjetas?error=${encodeURIComponent(err.message)}`);
  }
}

module.exports = { list, create, update, remove };
