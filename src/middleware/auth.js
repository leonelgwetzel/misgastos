function requireAuth(req, res, next) {
  if (!req.session?.userId) {
    return res.redirect('/auth/login');
  }
  next();
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
  next();
}

module.exports = { requireAuth, redirectIfAuth, attachUser };
