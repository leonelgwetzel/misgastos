const balanceService = require('./balance.service');
const plataService = require('./plata.service');
const proyeccionService = require('./proyeccion.service');

async function getBalanceResumen(userId) {
  return balanceService.getBalanceResumen(userId);
}

async function getVistaPlata(userId, monthKey) {
  return plataService.getVistaPlata(userId, monthKey);
}

async function getVistaCompromisos(userId, monthKey) {
  return proyeccionService.getCompromisosForMonth(userId, monthKey);
}

async function getProyeccionTarjetas12Meses(userId, monthKey) {
  return proyeccionService.getProyeccionTarjetas12Meses(userId, monthKey);
}

module.exports = {
  getBalanceResumen,
  getVistaPlata,
  getVistaCompromisos,
  getProyeccionTarjetas12Meses,
};
