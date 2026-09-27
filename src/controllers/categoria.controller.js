const categoriaService = require('../services/categoria.service');
const { ICONOS, COLORES, ICONO_DEFAULT, COLOR_DEFAULT } = require('../lib/categoriaEstilo');

async function renderPage(req, res, {
  errors = {},
  values = null,
  editing = null,
  status = 200,
  success = null,
} = {}) {
  const categorias = await categoriaService.listByUser(req.session.userId);

  return res.status(status).render('categorias/index', {
    title: 'Categorías',
    categorias,
    editing,
    errors,
    values: values || { nombre: '', icono: ICONO_DEFAULT, color: COLOR_DEFAULT },
    iconos: ICONOS,
    colores: COLORES,
    success: success != null ? success : (req.query.success || null),
    error: req.query.error || null,
  });
}

async function list(req, res) {
  let editing = null;
  let values = null;
  if (req.query.edit) {
    try {
      editing = await categoriaService.getForUser(req.session.userId, req.query.edit);
      values = {
        nombre: editing.nombre,
        icono: editing.icono || ICONO_DEFAULT,
        color: editing.color || COLOR_DEFAULT,
      };
    } catch {
      editing = null;
    }
  }
  return renderPage(req, res, { editing, values });
}

async function create(req, res) {
  try {
    await categoriaService.create(req.session.userId, req.body);
    return res.redirect('/categorias?success=creada');
  } catch (err) {
    const errors = err.issues
      ? Object.fromEntries(err.issues.map((e) => [e.path[0], e.message]))
      : { general: err.message };
    return renderPage(req, res, { errors, values: req.body, status: 400 });
  }
}

async function update(req, res) {
  try {
    await categoriaService.update(req.session.userId, req.params.id, req.body);
    return res.redirect('/categorias?success=actualizada');
  } catch (err) {
    const errors = err.issues
      ? Object.fromEntries(err.issues.map((e) => [e.path[0], e.message]))
      : { general: err.message };
    let editing = null;
    try {
      editing = await categoriaService.getForUser(req.session.userId, req.params.id);
    } catch {
      editing = { id: req.params.id };
    }
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
    await categoriaService.remove(req.session.userId, req.params.id);
    res.redirect('/categorias?success=eliminada');
  } catch (err) {
    res.redirect(`/categorias?error=${encodeURIComponent(err.message)}`);
  }
}

module.exports = { list, create, update, remove };
