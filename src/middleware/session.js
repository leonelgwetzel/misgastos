const { Pool } = require('pg');
const session = require('express-session');
const connectPgSimple = require('connect-pg-simple');

const PgSession = connectPgSimple(session);

function createSessionMiddleware() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  return session({
    store: new PgSession({
      pool,
      tableName: 'session',
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET || 'dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      sameSite: 'lax',
    },
    name: 'misgastos.sid',
  });
}

module.exports = { createSessionMiddleware };
