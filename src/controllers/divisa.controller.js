const divisaService = require('../services/divisa.service');
const prisma = require('../lib/prisma');

async function list(req, res) {
  const [divisas, usuario] = await Promise.all([
    divisaService.listByUser(req.session.userId),
    prisma.usuario.findUnique({
      where: { id: req.session.userId },
      include: { divisaPrincipal: true },
    }),
  ]);

  res.render('divisas/index', {
    title: 'Divisas',
    divisas,
    divisaPrincipal: usuario?.divisaPrincipal || null,
    errors: {},
    values: {},
    success: req.query.success || null,
  });
}

async function create(req, res) {
  try {
    await divisaService.createDivisa(req.session.userId, req.body);
    return res.redirect('/divisas?success=creada');
  } catch (err) {
    const [divisas, usuario] = await Promise.all([
      divisaService.listByUser(req.session.userId),
      prisma.usuario.findUnique({
        where: { id: req.session.userId },
        include: { divisaPrincipal: true },
      }),
    ]);

    const errors = err.issues
      ? Object.fromEntries(err.issues.map((e) => [e.path[0], e.message]))
      : { general: err.message };

    return res.status(400).render('divisas/index', {
      title: 'Divisas',
      divisas,
      divisaPrincipal: usuario?.divisaPrincipal,
      errors,
      values: req.body,
      success: null,
    });
  }
}

async function updateTarifa(req, res) {
  try {
    await divisaService.upsertTarifa(req.session.userId, req.body);
    return res.redirect('/divisas?success=tarifa');
  } catch (err) {
    const msg = err.issues
      ? err.issues.map((e) => e.message).join(', ')
      : err.message;
    return res.redirect(`/divisas?error=${encodeURIComponent(msg)}`);
  }
}

module.exports = { list, create, updateTarifa };
