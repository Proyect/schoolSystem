/*
  Script: scripts/createAdmin.js
  Uso:
    - npm run seed:admin
  Comportamiento:
    - Crea o actualiza un usuario admin usando ADMIN_EMAIL y ADMIN_PASSWORD del entorno.
    - Bloquea ejecución en producción salvo que FORCE=true.
*/

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../db');

(async () => {
  try {
    const isProd = process.env.NODE_ENV === 'production';
    if (isProd && process.env.FORCE !== 'true') {
      console.error('Este script no puede ejecutarse en producción sin FORCE=true');
      process.exit(1);
    }

    const email = process.env.ADMIN_EMAIL || 'admin@test.com';
    const plainPassword = process.env.ADMIN_PASSWORD || 'Admin123!';

    if (!email) {
      console.error('ADMIN_EMAIL no definido');
      process.exit(1);
    }

    if (!plainPassword || plainPassword.length < 6) {
      console.error('ADMIN_PASSWORD debe tener al menos 6 caracteres');
      process.exit(1);
    }

    const passwordHash = await bcrypt.hash(plainPassword, 10);

    // Verificar si existe el usuario
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);

    if (existing.rowCount > 0) {
      const id = existing.rows[0].id;
      await pool.query(
        'UPDATE users SET password = $1, role = $2, updated_at = NOW() WHERE id = $3',
        [passwordHash, 'admin', id]
      );
      console.log(`Usuario admin actualizado: ${email}`);
    } else {
      await pool.query(
        'INSERT INTO users (email, password, role, first_name, last_name) VALUES ($1, $2, $3, $4, $5)',
        [email.toLowerCase(), passwordHash, 'admin', 'Admin', 'Local']
      );
      console.log(`Usuario admin creado: ${email}`);
    }

    console.log('Listo. Puedes iniciar sesión con el admin configurado.');
    process.exit(0);
  } catch (err) {
    console.error('Error creando/actualizando admin:', err);
    process.exit(1);
  }
})();
