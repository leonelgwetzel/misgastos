const prisma = require('../lib/prisma');
const { toSessionUser } = require('../services/auth.service');

async function requireAuth(req, res, next) {
  if (!req.session?.userId) {
    return res.redirect('/auth/login');
  }
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: req.session.userId },
      include: { divisaPrincipal: true },
    });
    if (!usuario || !usuario.habilitado) {
      return req.session.destroy(() => res.redirect('/auth/login'));
    }
    req.session.user = toSessionUser(usuario);
    res.locals.user = req.session.user;
    res.locals.isAuthenticated = true;
    res.locals.isAdmin = usuario.perfil === 'admin';
    return next();
  } catch (err) {
    return next(err);
  }
}

function redirectIfAuth(req, res, next) {
  if (req.session?.userId) {
    return res.redirect('/');
  }
  next();
}

function attachUser(req, res, next) {
  res.locals.user = req.session?.user || null;
  res.locals.isAuthenticated = Boolean(req.session?.userId);
  res.locals.isAdmin = req.session?.user?.perfil === 'admin';
  next();
}

function requireAdmin(req, res, next) {
  if (req.session?.user?.perfil !== 'admin') {
    return res.status(404).render('errors/404', { title: 'No encontrado' });
  }
  next();
}

module.exports = { requireAuth, redirectIfAuth, attachUser, requireAdmin };
