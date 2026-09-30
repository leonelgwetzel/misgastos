const yearCalendarService = require('../services/yearCalendar.service');

function index(req, res) {
  if (req.query.year) {
    const year = yearCalendarService.parseYear(req.query.year);
    return res.redirect(`/?year=${year}&month=1#sec-anio`);
  }
  return res.redirect('/');
}

module.exports = { index };
