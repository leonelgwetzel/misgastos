const gastoService = require('../services/gasto.service');
const tarjetaService = require('../services/tarjeta.service');
const cuentaService = require('../services/cuenta.service');
const prisma = require('../lib/prisma');

const PAGE_SIZE = 15;

function parseListQuery(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const q = String(query.q || '').trim().slice(0, 100);
  return { page, q, pageSize: PAGE_SIZE };
}

function buildGastosQuery({ page, q }, extra = {}) {
  const params = new URLSearchParams();
  if (page > 1) params.set('page', String(page));
  if (q) params.set('q', q);
  Object.entries(extra).forEach(([key, value]) => {
    if (value != null && value !== '') params.set(key, value);
  });
  const qs = params.toString();
  return qs ? `/gastos?${qs}` : '/gastos';
}

async function loadFormOptions(userId) {
  const [tarjetas, cuentas, categorias, divisas] = await Promise.all([
    tarjetaService.listByUser(userId),
    cuentaService.listByUser(userId),
    prisma.categoria.findMany({
      where: { usuarioId: userId },
      orderBy: { nombre: 'asc' },
    }),
    prisma.divisa.findMany({
      where: { usuarioId: userId },
      orderBy: { codigo: 'asc' },
    }),
  ]);
  return { tarjetas, cuentas, categorias, divisas };
}

function formatDateInput(date) {
  const d = new Date(date);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

async function renderList(req, res, { errors = {}, values = null, status = 200, success = null, error = null } = {}) {
  const listQuery = parseListQuery(req.query);
  const [formOptions, gastosList] = await Promise.all([
    loadFormOptions(req.session.userId),
    gastoService.searchByUser(req.session.userId, listQuery),
  ]);

  const today = new Date();
  const fechaHoy = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  let editing = null;
  let formValues = values || {
    fechaCompra: fechaHoy,
    cantidadCuotas: 1,
    medioPago: 'TARJETA',
    mesImpactoPrimera: '',
  };

  if (!values && req.query.edit) {
    editing = await prisma.gasto.findFirst({
      where: { id: req.query.edit, usuarioId: req.session.userId },
      include: { categoria: true },
    });
    if (editing) {
      formValues = {
        descripcion: editing.descripcion,
        categoriaId: editing.categoriaId || '',
        medioPago: editing.medioPago,
        fechaCompra: formatDateInput(editing.fechaCompra),
        montoOriginal: Number(editing.montoOriginal),
      };
    }
  }

  const pagination = {
    page: gastosList.page,
    totalPages: gastosList.totalPages,
    total: gastosList.total,
    prevUrl: gastosList.page > 1
      ? buildGastosQuery({ page: gastosList.page - 1, q: listQuery.q })
      : null,
    nextUrl: gastosList.page < gastosList.totalPages
      ? buildGastosQuery({ page: gastosList.page + 1, q: listQuery.q })
      : null,
  };

  return res.status(status).render('gastos/index', {
    title: 'Gastos',
    ...formOptions,
    gastos: gastosList.items,
    filtro: { q: listQuery.q },
    pagination,
    editing,
    errors,
    values: formValues,
    success: success != null ? success : (req.query.success || null),
    error: error != null ? error : (req.query.error || null),
  });
}

async function list(req, res) {
  return renderList(req, res);
}

async function create(req, res) {
  const medioPago = req.body.medioPago || 'TARJETA';

  try {
    if (medioPago === 'TARJETA') {
      await gastoService.createTarjetaGasto(req.session.userId, req.body);
    } else {
      await gastoService.createEfectivoDebitoGasto(req.session.userId, {
        ...req.body,
        medioPago,
      });
    }
    return res.redirect(buildGastosQuery({ page: 1, q: '' }, { success: 'creado' }));
  } catch (err) {
    const errors = err.issues
      ? Object.fromEntries(err.issues.map((e) => [e.path[0], e.message]))
      : { general: err.message };
    return renderList(req, res, { errors, values: req.body, status: 400 });
  }
}

async function update(req, res) {
  const listQuery = parseListQuery(req.query);
  try {
    await gastoService.updateGastoMeta(req.session.userId, req.params.id, req.body);
    return res.redirect(buildGastosQuery(listQuery, { success: 'actualizado' }));
  } catch (err) {
    const errors = err.issues
      ? Object.fromEntries(err.issues.map((e) => [e.path[0], e.message]))
      : { general: err.message };
    req.query.edit = req.params.id;
    return renderList(req, res, { errors, values: req.body, status: 400 });
  }
}

async function remove(req, res) {
  const listQuery = parseListQuery(req.query);

  try {
    await gastoService.deleteGasto(req.session.userId, req.params.id);
    return res.redirect(buildGastosQuery(listQuery, { success: 'eliminado' }));
  } catch (err) {
    return res.redirect(buildGastosQuery(listQuery, { error: err.message }));
  }
}

module.exports = { list, create, update, remove };
