const cicloService = require('../services/cicloFacturacion.service');
const dashboardController = require('./dashboard.controller');

async function upsert(req, res) {
  const { tarjetaId, monthKey, fechaCierre, mesVencimiento } = req.body;

  try {
    await cicloService.upsertCiclo(req.session.userId, tarjetaId, monthKey, {
      fechaCierre,
      mesVencimiento: `${mesVencimiento}-01`,
    });

    if (req.get('HX-Request')) {
      const [year, month] = monthKey.split('-');
      req.query = {
        ...req.query,
        year,
        month,
        tab: 'compromisos',
      };
      return dashboardController.index(req, res);
    }

    const params = new URLSearchParams({
      year: monthKey.split('-')[0],
      month: monthKey.split('-')[1],
      tab: 'compromisos',
    });
    return res.redirect(`/?${params}`);
  } catch (err) {
    if (req.get('HX-Request')) {
      return res.status(400).send(err.message);
    }
    return res.redirect(`/?tab=compromisos&error=${encodeURIComponent(err.message)}`);
  }
}

module.exports = { upsert };
