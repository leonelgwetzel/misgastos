const telegramService = require('../services/telegram.service');

const AVISO_SIN_VINCULO = [
  'Este chat todavía no está vinculado a una cuenta de misgastos.',
  '',
  'Entrá a Configuración → Telegram en la web, generá un código y mandámelo acá con:',
  '/vincular ABC123',
].join('\n');

/**
 * Deja pasar solo chats privados vinculados y expone el usuario en ctx.usuario.
 */
async function requireVinculo(ctx, next) {
  if (ctx.chat?.type !== 'private') return;

  const usuario = await telegramService.resolverUsuario(ctx.chat.id);

  if (!usuario) {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({ text: 'Chat no vinculado.', show_alert: true });
    } else {
      await ctx.reply(AVISO_SIN_VINCULO);
    }
    return;
  }

  ctx.usuario = usuario;
  return next();
}

module.exports = { requireVinculo, AVISO_SIN_VINCULO };
