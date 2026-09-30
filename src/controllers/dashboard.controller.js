const dashboardService = require('../services/dashboard.service');
const yearCalendarService = require('../services/yearCalendar.service');
const gastoFijoService = require('../services/gastoFijo.service');
const ingresoFijoService = require('../services/ingresoFijo.service');
const { parseMonthParams, monthNavUrls } = require('../lib/dates');

async function index(req, res) {
  const { year, month, label, key } = parseMonthParams(req.query);
  const nav = monthNavUrls(year, month);

  await gastoFijoService.generateForMonth(req.session.userId, key);
  await ingresoFijoService.generateForMonth(req.session.userId, key);

  const vistaPlata = await dashboardService.getVistaPlataConContexto(req.session.userId, key);
  const vistaCompromisos = await dashboardService.getVistaCompromisos(req.session.userId, key);
  const calendario = await yearCalendarService.getYearCalendar(req.session.userId, year);

  const payload = {
    title: 'Dashboard',
    month: { year, month, label, key },
    nav,
    vistaPlata,
    vistaCompromisos,
    calendario,
    hideCanvasTop: true,
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
