const yearCalendarService = require('../services/yearCalendar.service');

async function index(req, res) {
  const year = yearCalendarService.parseYear(req.query.year);
  const calendar = await yearCalendarService.getYearCalendar(req.session.userId, year);

  return res.render('dashboard/year', {
    title: 'Resumen anual',
    calendar,
  });
}

module.exports = { index };
