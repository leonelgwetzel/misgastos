const { InlineKeyboard } = require('grammy');

const SIN_VALOR = '-';

const ICONO_CUENTA = { BANCO: '🏦', BILLETERA: '📱', EFECTIVO: '💵' };

function enFilas(teclado, botones, porFila) {
  botones.forEach((boton, i) => {
    if (i > 0 && i % porFila === 0) teclado.row();
    teclado.text(boton.texto, boton.data);
  });
  return teclado;
}

function medioPago({ hayTarjetas }) {
  const teclado = new InlineKeyboard()
    .text('💵 Efectivo', 'b:medio:EFECTIVO')
    .text('💳 Débito', 'b:medio:DEBITO');

  if (hayTarjetas) teclado.row().text('🧾 Tarjeta de crédito', 'b:medio:TARJETA');

  return teclado.row().text('✖️ Cancelar', 'b:cancel');
}

function cuentas(lista, { permitirSinCuenta }) {
  const teclado = new InlineKeyboard();
  const botones = lista.map((c) => ({
    texto: `${ICONO_CUENTA[c.tipo] || '💼'} ${c.nombre}`,
    data: `b:cuenta:${c.id}`,
  }));

  enFilas(teclado, botones, 2);

  if (botones.length > 0) teclado.row();
  if (permitirSinCuenta) teclado.text('Sin cuenta (no toca saldos)', `b:cuenta:${SIN_VALOR}`).row();

  return teclado.text('✖️ Cancelar', 'b:cancel');
}

function tarjetas(lista) {
  const teclado = new InlineKeyboard();
  enFilas(teclado, lista.map((t) => ({ texto: `💳 ${t.alias}`, data: `b:tarjeta:${t.id}` })), 2);
  return teclado.row().text('✖️ Cancelar', 'b:cancel');
}

function cuotas(opciones = [1, 3, 6, 9, 12, 18]) {
  const teclado = new InlineKeyboard();
  enFilas(teclado, opciones.map((n) => ({
    texto: n === 1 ? '1 pago' : `${n} cuotas`,
    data: `b:cuotas:${n}`,
  })), 3);
  return teclado.row().text('✖️ Cancelar', 'b:cancel');
}

function categorias(lista) {
  const teclado = new InlineKeyboard();
  enFilas(teclado, lista.map((c) => ({ texto: c.nombre, data: `b:cat:${c.id}` })), 2);

  if (lista.length > 0) teclado.row();
  return teclado
    .text('Sin categoría', `b:cat:${SIN_VALOR}`)
    .row()
    .text('✖️ Cancelar', 'b:cancel');
}

function confirmar() {
  return new InlineKeyboard()
    .text('✅ Guardar', 'b:ok')
    .text('✖️ Cancelar', 'b:cancel');
}

function deshacer(tipo, id) {
  return new InlineKeyboard().text('↩️ Deshacer', `u:${tipo}:${id}`);
}

function borrar(items) {
  const teclado = new InlineKeyboard();
  enFilas(teclado, items.map((item, i) => ({
    texto: `🗑 ${i + 1}`,
    data: `d:${item.tipo}:${item.id}`,
  })), 5);
  return teclado;
}

module.exports = {
  SIN_VALOR,
  medioPago,
  cuentas,
  tarjetas,
  cuotas,
  categorias,
  confirmar,
  deshacer,
  borrar,
};
