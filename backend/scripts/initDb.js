/*
  Script: scripts/initDb.js
  Descripción: Inicializa la base de datos con usuarios de prueba
  Se ejecuta automáticamente al iniciar el servidor en modo desarrollo con pg-mem
*/

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../db');

const initDatabase = async () => {
  try {
    // Verificar si ya hay usuarios
    const existingUsers = await pool.query('SELECT COUNT(*) as count FROM users');
    
    if (parseInt(existingUsers.rows[0].count) > 0) {
      console.log('✓ Base de datos ya inicializada');
      return;
    }

    console.log('Inicializando base de datos con usuarios de prueba...');

    // Crear usuarios de prueba
    const passwordHash = await bcrypt.hash('password123', 10);
    
    const users = [
      { email: 'admin@school.com', password: passwordHash, role: 'admin', first_name: 'Admin', last_name: 'User' },
      { email: 'teacher@school.com', password: passwordHash, role: 'teacher', first_name: 'Teacher', last_name: 'User' },
      { email: 'student@school.com', password: passwordHash, role: 'student', first_name: 'Student', last_name: 'User' }
    ];

    for (const user of users) {
      await pool.query(
        'INSERT INTO users (email, password, role, first_name, last_name) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (email) DO NOTHING',
        [user.email, user.password, user.role, user.first_name, user.last_name]
      );
    }

    // Crear algunas computadoras de ejemplo
    const adminUser = await pool.query('SELECT id FROM users WHERE email = $1', ['admin@school.com']);
    if (adminUser.rows.length > 0) {
      const adminId = adminUser.rows[0].id;
      
      const computers = [
        { code: 'PC001', description: 'Computadora de laboratorio 1', created_by: adminId },
        { code: 'PC002', description: 'Computadora de laboratorio 2', created_by: adminId },
        { code: 'PC003', description: 'Computadora de laboratorio 3', created_by: adminId }
      ];

      for (const computer of computers) {
        await pool.query(
          'INSERT INTO computers (code, description, created_by) VALUES ($1, $2, $3) ON CONFLICT (code) DO NOTHING',
          [computer.code, computer.description, computer.created_by]
        );
      }

      // Configuración del sistema por defecto (si la tabla existe y está vacía)
      const settingsCount = await pool.query('SELECT COUNT(*) as c FROM system_settings').catch(() => ({ rows: [{ c: 1 }] }));
      if (parseInt(settingsCount.rows[0]?.c || 1) === 0) {
        const defaults = [
          ['max_reservation_hours', '4', 'number', 'Duración máxima de reserva en horas'],
          ['advance_booking_days', '7', 'number', 'Días de anticipación para reservar'],
          ['max_active_reservations', '3', 'number', 'Máximo de reservas activas por usuario'],
          ['auto_logout_minutes', '30', 'number', 'Minutos de inactividad antes del logout'],
          ['maintenance_mode', 'false', 'boolean', 'Modo de mantenimiento del sistema']
        ];
        for (const [key, value, type, desc] of defaults) {
          await pool.query(
            'INSERT INTO system_settings (setting_key, setting_value, setting_type, description) VALUES ($1, $2, $3, $4) ON CONFLICT (setting_key) DO NOTHING',
            [key, value, type, desc]
          ).catch(() => {});
        }
      }
    }

    console.log('✓ Base de datos inicializada con usuarios de prueba');
    console.log('  - admin@school.com / password123 (Admin)');
    console.log('  - teacher@school.com / password123 (Teacher)');
    console.log('  - student@school.com / password123 (Student)');
  } catch (error) {
    console.error('Error inicializando base de datos:', error);
  }
};

// Ejecutar solo si se llama directamente
if (require.main === module) {
  initDatabase().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { initDatabase };

