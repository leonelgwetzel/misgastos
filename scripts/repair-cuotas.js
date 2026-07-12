const { PrismaClient } = require('@prisma/client');
const cuotaService = require('../src/services/cuota.service');
const { buildDefaultCicloDates, monthKeyFromDbDate } = require('../src/lib/dates');

const prisma = new PrismaClient();

async function recalculateCiclosFromDefaults(userId) {
  const tarjetas = await prisma.tarjeta.findMany({ where: { usuarioId: userId } });

  for (const tarjeta of tarjetas) {
    const ciclos = await prisma.cicloFacturacion.findMany({
      where: { tarjetaId: tarjeta.id },
    });

    for (const ciclo of ciclos) {
      const key = monthKeyFromDbDate(ciclo.mesReferencia);
      const [y, m] = key.split('-').map(Number);
      const defaults = buildDefaultCicloDates(
        y,
        m,
        tarjeta.defaultCierreDia,
        tarjeta.defaultVencimientoMes,
      );

      await prisma.cicloFacturacion.update({
        where: { id: ciclo.id },
        data: {
          fechaCierre: defaults.fechaCierre,
          mesVencimiento: defaults.mesVencimiento,
        },
      });
    }
  }
}

async function main() {
  const usuarios = await prisma.usuario.findMany({ select: { id: true, email: true } });

  for (const usuario of usuarios) {
    await recalculateCiclosFromDefaults(usuario.id);
    await cuotaService.recalculateMesImpactoForTarjetaGastos(usuario.id);
    console.log(`Ciclos y cuotas recalculados para ${usuario.email}`);
  }

  const mopas = await prisma.gasto.findMany({
    where: { descripcion: { contains: 'Mopa' } },
    include: { cuotas: { orderBy: { numero: 'asc' } } },
  });

  for (const g of mopas) {
    console.log(
      g.descripcion,
      g.cuotas.map((c) => `cuota ${c.numero} → ${c.mesImpacto.toISOString().slice(0, 10)}`),
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
