const usuarioService = require('../services/usuario.service');

function emptyValues() {
  return {
    nombre: '',
    email: '',
    password: '',
    perfil: 'cliente',
    habilitado: true,
  };
}

async function renderPage(req, res, {
  errors = {},
  values = null,
  editing = null,
  status = 200,
  success = null,
} = {}) {
  const usuarios = await usuarioService.listAll();
  return res.status(status).render('usuarios/index', {
    title: 'Usuarios',
    usuarios,
    editing,
    errors,
    values: values || emptyValues(),
    actorId: req.session.userId,
    success: success != null ? success : (req.query.success || null),
    error: req.query.error || null,
  });
}

async function list(req, res) {
  let editing = null;
  let values = null;
  if (req.query.edit) {
    try {
      editing = await usuarioService.getById(req.query.edit);
      values = {
        nombre: editing.nombre,
        email: editing.email,
        password: '',
        perfil: editing.perfil,
        habilitado: editing.habilitado,
      };
    } catch {
      editing = null;
    }
  }
  return renderPage(req, res, { editing, values });
}

async function create(req, res) {
  try {
    await usuarioService.create(req.body);
    return res.redirect('/usuarios?success=creado');
  } catch (err) {
    const errors = err.issues
      ? Object.fromEntries(err.issues.map((e) => [e.path[0], e.message]))
      : { general: err.message };
    return renderPage(req, res, { errors, values: { ...emptyValues(), ...req.body }, status: 400 });
  }
}

async function update(req, res) {
  try {
    await usuarioService.update(req.params.id, req.body, req.session.userId);
    return res.redirect('/usuarios?success=actualizado');
  } catch (err) {
    const errors = err.issues
      ? Object.fromEntries(err.issues.map((e) => [e.path[0], e.message]))
      : { general: err.message };
    let editing = null;
    try {
      editing = await usuarioService.getById(req.params.id);
    } catch {
      editing = { id: req.params.id };
    }
    return renderPage(req, res, {
      errors,
      values: { ...emptyValues(), ...req.body },
      editing,
      status: 400,
    });
  }
}

async function habilitar(req, res) {
  try {
    await usuarioService.setHabilitado(req.params.id, true, req.session.userId);
    return res.redirect('/usuarios?success=habilitado');
  } catch (err) {
    return res.redirect(`/usuarios?error=${encodeURIComponent(err.message)}`);
  }
}

async function deshabilitar(req, res) {
  try {
    await usuarioService.setHabilitado(req.params.id, false, req.session.userId);
    return res.redirect('/usuarios?success=deshabilitado');
  } catch (err) {
    return res.redirect(`/usuarios?error=${encodeURIComponent(err.message)}`);
  }
}

async function remove(req, res) {
  try {
    await usuarioService.remove(req.params.id, req.session.userId);
    return res.redirect('/usuarios?success=eliminado');
  } catch (err) {
    return res.redirect(`/usuarios?error=${encodeURIComponent(err.message)}`);
  }
}

module.exports = {
  list,
  create,
  update,
  habilitar,
  deshabilitar,
  remove,
};
