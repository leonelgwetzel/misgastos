const ingresoService = require('../services/ingreso.service');
const cuentaService = require('../services/cuenta.service');
const prisma = require('../lib/prisma');

const PAGE_SIZE = 15;

function parseListQuery(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const q = String(query.q || '').trim().slice(0, 100);
  return { page, q, pageSize: PAGE_SIZE };
}

function buildIngresosQuery({ page, q }, extra = {}) {
  const params = new URLSearchParams();
  if (page > 1) params.set('page', String(page));
  if (q) params.set('q', q);
  Object.entries(extra).forEach(([key, value]) => {
    if (value != null && value !== '') params.set(key, value);
  });
  const qs = params.toString();
  return qs ? `/ingresos?${qs}` : '/ingresos';
}

async function loadFormOptions(userId) {
  const [cuentas, categorias] = await Promise.all([
    cuentaService.listByUser(userId),
    prisma.categoria.findMany({
      where: { usuarioId: userId },
      orderBy: { nombre: 'asc' },
    }),
  ]);
  return { cuentas: cuentas.filter((c) => c.activa), categorias };
}

async function list(req, res) {
  const listQuery = parseListQuery(req.query);
  const editId = req.query.edit || null;

  const [formOptions, ingresosList, editing] = await Promise.all([
    loadFormOptions(req.session.userId),
    ingresoService.searchByUser(req.session.userId, listQuery),
    editId ? ingresoService.getIngresoForUser(req.session.userId, editId) : null,
  ]);

  const today = new Date();
  const fechaHoy = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const pagination = {
    page: ingresosList.page,
    totalPages: ingresosList.totalPages,
    total: ingresosList.total,
    prevUrl: ingresosList.page > 1
      ? buildIngresosQuery({ page: ingresosList.page - 1, q: listQuery.q })
      : null,
    nextUrl: ingresosList.page < ingresosList.totalPages
      ? buildIngresosQuery({ page: ingresosList.page + 1, q: listQuery.q })
      : null,
  };

  res.render('ingresos/index', {
    title: 'Ingresos',
    ...formOptions,
    ingresos: ingresosList.items,
    filtro: { q: listQuery.q },
    pagination,
    editing,
    errors: {},
    values: editing
      ? ingresoService.toFormValues(editing)
      : { fecha: fechaHoy },
    success: req.query.success || null,
    error: req.query.error || null,
  });
}

async function create(req, res) {
  try {
    await ingresoService.create(req.session.userId, req.body);
    return res.redirect(buildIngresosQuery({ page: 1, q: '' }, { success: 'creado' }));
  } catch (err) {
    return renderError(req, res, err, req.body);
  }
}

async function update(req, res) {
  const listQuery = parseListQuery(req.query);

  try {
    await ingresoService.update(req.session.userId, req.params.id, req.body);
    return res.redirect(buildIngresosQuery(listQuery, { success: 'actualizado' }));
  } catch (err) {
    return renderError(req, res, err, req.body, req.params.id);
  }
}

async function remove(req, res) {
  const listQuery = parseListQuery(req.query);

  try {
    await ingresoService.remove(req.session.userId, req.params.id);
    return res.redirect(buildIngresosQuery(listQuery, { success: 'eliminado' }));
  } catch (err) {
    return res.redirect(buildIngresosQuery(listQuery, { error: err.message }));
  }
}

async function renderError(req, res, err, values, editId = null) {
  const listQuery = parseListQuery(req.query);
  const [formOptions, ingresosList, editing] = await Promise.all([
    loadFormOptions(req.session.userId),
    ingresoService.searchByUser(req.session.userId, listQuery),
    editId ? ingresoService.getIngresoForUser(req.session.userId, editId).catch(() => null) : null,
  ]);

  const errors = err.issues
    ? Object.fromEntries(err.issues.map((e) => [e.path[0], e.message]))
    : { general: err.message };

  return res.status(400).render('ingresos/index', {
    title: 'Ingresos',
    ...formOptions,
    ingresos: ingresosList.items,
    filtro: { q: listQuery.q },
    pagination: {
      page: ingresosList.page,
      totalPages: ingresosList.totalPages,
      total: ingresosList.total,
      prevUrl: null,
      nextUrl: null,
    },
    editing,
    errors,
    values,
    success: null,
    error: null,
  });
}

module.exports = { list, create, update, remove };
