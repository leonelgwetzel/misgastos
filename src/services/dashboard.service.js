const balanceService = require('./balance.service');
const plataService = require('./plata.service');
const proyeccionService = require('./proyeccion.service');

async function getBalanceResumen(userId) {
  return balanceService.getBalanceResumen(userId);
}

async function getVistaPlata(userId, monthKey) {
  return plataService.getVistaPlata(userId, monthKey);
}

async function getVistaPlataConContexto(userId, monthKey) {
  return plataService.getVistaPlataConContexto(userId, monthKey);
}

async function getVistaCompromisos(userId, monthKey) {
  return proyeccionService.getCompromisosForMonth(userId, monthKey);
}

async function getProyeccionTarjetas12Meses(userId, monthKey) {
  return proyeccionService.getProyeccionTarjetas12Meses(userId, monthKey);
}

function sliceProyeccionTarjetas(proyeccion, monthCount) {
  return proyeccionService.sliceProyeccion(proyeccion, monthCount);
}

module.exports = {
  getBalanceResumen,
  getVistaPlata,
  getVistaPlataConContexto,
  getVistaCompromisos,
  getProyeccionTarjetas12Meses,
  sliceProyeccionTarjetas,
};
