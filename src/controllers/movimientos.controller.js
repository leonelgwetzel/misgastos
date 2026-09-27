async function index(req, res) {
  const tab = req.query.tab === 'ingresos' ? 'ingresos' : 'gastos';
  return res.redirect(tab === 'ingresos' ? '/ingresos' : '/gastos');
}

module.exports = { index };
