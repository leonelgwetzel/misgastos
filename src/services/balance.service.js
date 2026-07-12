const prisma = require('../lib/prisma');
const { roundMoney } = require('../lib/money');
const divisaService = require('./divisa.service');

async function getBalanceResumen(userId) {
  const [cuentas, usuario] = await Promise.all([
    prisma.cuenta.findMany({
      where: { usuarioId: userId, activa: true },
      include: { divisa: true },
    }),
    prisma.usuario.findUnique({
      where: { id: userId },
      include: { divisaPrincipal: true },
    }),
  ]);

  const porDivisa = new Map();

  for (const cuenta of cuentas) {
    const key = cuenta.divisaId;
    const prev = porDivisa.get(key) || {
      codigo: cuenta.divisa.codigo,
      simbolo: cuenta.divisa.simbolo,
      saldo: 0,
    };
    prev.saldo = roundMoney(prev.saldo + Number(cuenta.saldoActual));
    porDivisa.set(key, prev);
  }

  const divisas = Array.from(porDivisa.values()).sort((a, b) => a.codigo.localeCompare(b.codigo));

  let totalPrincipal = 0;
  for (const d of divisas) {
  const divisaRecord = cuentas.find((c) => c.divisa.codigo === d.codigo)?.divisa;
    if (!divisaRecord) continue;
    const { montoPrincipal } = await divisaService.resolveMontoPrincipal(
      userId,
      divisaRecord.id,
      d.saldo,
    );
    totalPrincipal = roundMoney(totalPrincipal + montoPrincipal);
  }

  return {
    divisas,
    divisaPrincipal: usuario?.divisaPrincipal || null,
    totalPrincipal,
  };
}

module.exports = {
  getBalanceResumen,
};
