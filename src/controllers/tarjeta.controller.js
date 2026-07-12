const tarjetaService = require('../services/tarjeta.service');
const prisma = require('../lib/prisma');

async function list(req, res) {
  const tarjetas = await tarjetaService.listByUser(req.session.userId);
  const divisas = await prisma.divisa.findMany({
    where: { usuarioId: req.session.userId },
    orderBy: { codigo: 'asc' },
  });

  res.render('tarjetas/index', {
    title: 'Tarjetas',
    tarjetas,
    divisas,
    errors: {},
    values: {
      defaultCierreDia: 25,
      defaultVencimientoMes: 1,
      titularidad: 'PROPIA',
    },
    success: req.query.success || null,
  });
}

async function create(req, res) {
  const divisas = await prisma.divisa.findMany({
    where: { usuarioId: req.session.userId },
  });

  try {
    await tarjetaService.create(req.session.userId, req.body);
    return res.redirect('/tarjetas?success=creada');
  } catch (err) {
    const errors = err.issues
      ? Object.fromEntries(err.issues.map((e) => [e.path[0], e.message]))
      : { general: err.message };

    const tarjetas = await tarjetaService.listByUser(req.session.userId);
    return res.status(400).render('tarjetas/index', {
      title: 'Tarjetas',
      tarjetas,
      divisas,
      errors,
      values: req.body,
      success: null,
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

module.exports = { list, create, remove };
