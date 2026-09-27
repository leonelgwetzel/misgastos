const telegramService = require('../services/telegram.service');

async function index(req, res) {
  const telegram = await telegramService.getEstado(req.session.userId);

  res.render('configuracion/index', {
    title: 'Configuración',
    telegram,
    ttlMinutos: telegramService.CODIGO_TTL_MINUTOS,
    success: req.query.success || null,
    error: req.query.error || null,
  });
}

async function crearCodigoTelegram(req, res) {
  try {
    await telegramService.crearCodigo(req.session.userId);
    return res.redirect('/configuracion?success=codigo#form');
  } catch (err) {
    return res.redirect(`/configuracion?error=${encodeURIComponent(err.message)}#form`);
  }
}

async function desvincularTelegram(req, res) {
  try {
    await telegramService.desvincularPorId(req.session.userId, req.params.id);
    return res.redirect('/configuracion?success=desvinculado');
  } catch (err) {
    return res.redirect(`/configuracion?error=${encodeURIComponent(err.message)}`);
  }
}

module.exports = { index, crearCodigoTelegram, desvincularTelegram };
