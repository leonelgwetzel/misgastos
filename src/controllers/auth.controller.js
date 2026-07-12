const authService = require('../services/auth.service');

function renderLogin(req, res) {
  res.render('auth/login', {
    title: 'Iniciar sesión',
    errors: {},
    values: { email: '' },
  });
}

async function postLogin(req, res) {
  const parsed = authService.loginSchema.safeParse(req.body);
  if (!parsed.success) {
    const errors = {};
    parsed.error.issues.forEach((e) => {
      errors[e.path[0]] = e.message;
    });
    return res.status(400).render('auth/login', {
      title: 'Iniciar sesión',
      errors,
      values: { email: req.body.email || '' },
    });
  }

  const result = await authService.login(parsed.data);
  if (result.error) {
    return res.status(401).render('auth/login', {
      title: 'Iniciar sesión',
      errors: { general: result.error },
      values: { email: parsed.data.email },
    });
  }

  req.session.userId = result.usuario.id;
  req.session.user = authService.toSessionUser(result.usuario);
  return res.redirect('/');
}

function renderRegister(req, res) {
  res.render('auth/register', {
    title: 'Crear cuenta',
    errors: {},
    values: { nombre: '', email: '' },
  });
}

async function postRegister(req, res) {
  const parsed = authService.registerSchema.safeParse(req.body);
  if (!parsed.success) {
    const errors = {};
    parsed.error.issues.forEach((e) => {
      errors[e.path[0]] = e.message;
    });
    return res.status(400).render('auth/register', {
      title: 'Crear cuenta',
      errors,
      values: { nombre: req.body.nombre || '', email: req.body.email || '' },
    });
  }

  const { passwordConfirm, ...data } = parsed.data;
  const result = await authService.register(data);
  if (result.error) {
    return res.status(400).render('auth/register', {
      title: 'Crear cuenta',
      errors: { general: result.error },
      values: { nombre: data.nombre, email: data.email },
    });
  }

  const loginResult = await authService.login({
    email: data.email,
    password: data.password,
  });

  req.session.userId = loginResult.usuario.id;
  req.session.user = authService.toSessionUser(loginResult.usuario);

  return res.redirect('/');
}

function postLogout(req, res) {
  req.session.destroy(() => {
    res.redirect('/auth/login');
  });
}

module.exports = {
  renderLogin,
  postLogin,
  renderRegister,
  postRegister,
  postLogout,
};
