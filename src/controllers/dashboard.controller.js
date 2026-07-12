const dashboardService = require('../services/dashboard.service');
const gastoFijoService = require('../services/gastoFijo.service');
const { parseMonthParams, monthNavUrls } = require('../lib/dates');

async function index(req, res) {
  const { year, month, label, key } = parseMonthParams(req.query);
  const tab = req.query.tab === 'plata' ? 'plata' : 'compromisos';
  const nav = monthNavUrls(year, month, tab);

  await gastoFijoService.generateForMonth(req.session.userId, key);

  const balance = await dashboardService.getBalanceResumen(req.session.userId);
  const vistaPlata = await dashboardService.getVistaPlata(req.session.userId, key);
  const vistaCompromisos = await dashboardService.getVistaCompromisos(req.session.userId, key);
  const proyeccionTarjetas = tab === 'compromisos'
    ? await dashboardService.getProyeccionTarjetas12Meses(req.session.userId, key)
    : null;

  const payload = {
    title: 'Inicio',
    month: { year, month, label, key },
    tab,
    nav,
    balance,
    vistaPlata,
    vistaCompromisos,
    proyeccionTarjetas,
    isHtmx: req.get('HX-Request') === 'true',
  };

  if (payload.isHtmx) {
    payload.layout = false;
    if (req.query.partial === 'month') {
      return res.render('partials/month-shell', payload);
    }
    return res.render('partials/tab-content', payload);
  }

  return res.render('dashboard/index', payload);
}

module.exports = { index };
