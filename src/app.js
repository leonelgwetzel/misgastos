const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const path = require('path');
const { createSessionMiddleware } = require('./middleware/session');
const { attachUser } = require('./middleware/auth');
const authRoutes = require('./routes/auth.routes');
const indexRoutes = require('./routes/index.routes');
const tarjetaRoutes = require('./routes/tarjeta.routes');
const gastoRoutes = require('./routes/gasto.routes');
const cuentaRoutes = require('./routes/cuenta.routes');
const divisaRoutes = require('./routes/divisa.routes');
const gastoFijoRoutes = require('./routes/gastoFijo.routes');
const ingresoFijoRoutes = require('./routes/ingresoFijo.routes');
const categoriaRoutes = require('./routes/categoria.routes');
const ingresoRoutes = require('./routes/ingreso.routes');
const movimientosRoutes = require('./routes/movimientos.routes');
const configRoutes = require('./routes/config.routes');
const yearDashboardRoutes = require('./routes/yearDashboard.routes');
const usuarioRoutes = require('./routes/usuario.routes');

function createApp() {
  const app = express();
  app.set('trust proxy', 1);

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  app.use(expressLayouts);
  app.set('layout', 'layouts/main');
  app.use(express.static(path.join(__dirname, '..', 'public')));
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  app.use(createSessionMiddleware());
  app.use(attachUser);
  app.use((req, res, next) => {
    res.locals.currentPath = req.path;
    next();
  });

  app.use('/auth', authRoutes);
  app.use('/movimientos', movimientosRoutes);
  app.use('/configuracion', configRoutes);
  app.use('/dashboard', yearDashboardRoutes);
  app.use('/tarjetas', tarjetaRoutes);
  app.use('/gastos', gastoRoutes);
  app.use('/cuentas', cuentaRoutes);
  app.use('/divisas', divisaRoutes);
  app.use('/gastos-fijos', gastoFijoRoutes);
  app.use('/ingresos-fijos', ingresoFijoRoutes);
  app.use('/categorias', categoriaRoutes);
  app.use('/usuarios', usuarioRoutes);
  app.use('/ingresos', ingresoRoutes);
  app.use('/', indexRoutes);

  app.use((req, res) => {
    res.status(404).render('errors/404', { title: 'No encontrado' });
  });

  app.use((err, req, res, _next) => {
    console.error(err);
    res.status(500).render('errors/500', {
      title: 'Error',
      message: process.env.NODE_ENV === 'development' ? err.message : 'Error interno',
    });
  });

  return app;
}

module.exports = { createApp };
