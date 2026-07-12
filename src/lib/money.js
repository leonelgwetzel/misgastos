/**
 * Divide un monto en N cuotas iguales; la última absorbe la diferencia (RB-006).
 */
function splitInstallments(total, count) {
  const cents = Math.round(Number(total) * 100);
  const base = Math.floor(cents / count);
  const remainder = cents - base * count;
  const amounts = [];
  for (let i = 0; i < count; i += 1) {
    const extra = i === count - 1 ? remainder : 0;
    amounts.push((base + extra) / 100);
  }
  return amounts;
}

function toNumber(value) {
  return Number(value);
}

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100;
}

function convertToPrincipal(montoOriginal, tasa) {
  return roundMoney(Number(montoOriginal) * Number(tasa));
}

module.exports = {
  splitInstallments,
  toNumber,
  roundMoney,
  convertToPrincipal,
};
