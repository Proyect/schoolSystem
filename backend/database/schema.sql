-- Tabla de usuarios
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'student',
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

  -- Tabla de computadoras/notebooks (status: available, in_use, maintenance, out_of_service)
  CREATE TABLE computers (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    serial_number VARCHAR(100),
    hardware_id VARCHAR(100),
    status VARCHAR(30) NOT NULL DEFAULT 'available',
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

-- Tabla de reservas
CREATE TABLE reservations (
    id SERIAL PRIMARY KEY,
    computer_id INTEGER REFERENCES computers(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices simples para optimizar consultas
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_computers_code ON computers(code);
CREATE INDEX idx_computers_serial_number ON computers(serial_number);
CREATE INDEX idx_computers_hardware_id ON computers(hardware_id);
CREATE INDEX idx_computers_status ON computers(status);
CREATE INDEX idx_computers_created_by ON computers(created_by);
CREATE INDEX idx_reservations_computer_id ON reservations(computer_id);
CREATE INDEX idx_reservations_user_id ON reservations(user_id);
CREATE INDEX idx_reservations_start_time ON reservations(start_time);
CREATE INDEX idx_reservations_status ON reservations(status);

-- Índices compuestos para consultas complejas
CREATE INDEX idx_reservations_computer_time ON reservations(computer_id, start_time, end_time);
CREATE INDEX idx_reservations_user_status ON reservations(user_id, status);
CREATE INDEX idx_reservations_time_status ON reservations(start_time, status);
CREATE INDEX idx_users_role_created ON users(role, created_at);
CREATE INDEX idx_computers_status_created ON computers(status, created_at);

-- Índices para consultas de reportes
CREATE INDEX idx_reservations_date_range ON reservations(start_time, end_time) WHERE status != 'cancelled';
CREATE INDEX idx_users_created_month ON users(created_at) WHERE created_at >= NOW() - INTERVAL '12 months';

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- EXECUTE PROCEDURE compatible con PostgreSQL < 11
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_computers_updated_at BEFORE UPDATE ON computers
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Insertar datos de ejemplo
INSERT INTO users (email, password, role, first_name, last_name) VALUES
('admin@school.com', '$2a$10$rQZ8N3YqX2vB5cD7eF9gH.iJ1kL2mN3oP4qR5sT6uV7wX8yZ9aA0bB1cC2d', 'admin', 'Admin', 'User'),
('teacher@school.com', '$2a$10$rQZ8N3YqX2vB5cD7eF9gH.iJ1kL2mN3oP4qR5sT6uV7wX8yZ9aA0bB1cC2d', 'teacher', 'Teacher', 'User'),
('student@school.com', '$2a$10$rQZ8N3YqX2vB5cD7eF9gH.iJ1kL2mN3oP4qR5sT6uV7wX8yZ9aA0bB1cC2d', 'student', 'Student', 'User');

-- Tabla de auditoría para seguridad
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(255) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    resource_id INTEGER,
    status_code INTEGER,
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de configuración del sistema
CREATE TABLE system_settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(255) UNIQUE NOT NULL,
    setting_value TEXT NOT NULL,
    setting_type VARCHAR(50) NOT NULL DEFAULT 'string',
    description TEXT,
    updated_by INTEGER REFERENCES users(id),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para auditoría
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_ip_address ON audit_logs(ip_address);

-- Índices para configuración
CREATE INDEX idx_system_settings_key ON system_settings(setting_key);

-- Insertar configuraciones por defecto
INSERT INTO system_settings (setting_key, setting_value, setting_type, description) VALUES
('max_reservation_hours', '4', 'number', 'Duración máxima de reserva en horas'),
('advance_booking_days', '7', 'number', 'Días de anticipación para reservar'),
('max_active_reservations', '3', 'number', 'Máximo número de reservas activas por usuario'),
('auto_logout_minutes', '30', 'number', 'Minutos de inactividad antes del logout automático'),
('maintenance_mode', 'false', 'boolean', 'Modo de mantenimiento del sistema'),
('allow_weekend_reservations', 'true', 'boolean', 'Permitir reservas en fines de semana'),
('notification_email', 'admin@school.com', 'string', 'Email para notificaciones del sistema'),
('session_timeout', '3600', 'number', 'Timeout de sesión en segundos'),
('max_login_attempts', '5', 'number', 'Máximo número de intentos de login'),
('password_min_length', '6', 'number', 'Longitud mínima de contraseña'),
('enable_audit_logs', 'true', 'boolean', 'Habilitar logs de auditoría'),
('cache_duration', '300', 'number', 'Duración del cache en segundos');

-- Vistas materializadas para reportes frecuentes
CREATE MATERIALIZED VIEW mv_computer_usage_stats AS
SELECT 
    c.id,
    c.code,
    c.description,
    COUNT(r.id) as total_reservations,
    COUNT(CASE WHEN r.status = 'completed' THEN 1 END) as completed_reservations,
    COUNT(CASE WHEN r.status = 'cancelled' THEN 1 END) as cancelled_reservations,
    COALESCE(SUM(EXTRACT(EPOCH FROM (r.end_time - r.start_time))/3600), 0) as total_hours_used,
    COALESCE(AVG(EXTRACT(EPOCH FROM (r.end_time - r.start_time))/3600), 0) as avg_duration_hours,
    MAX(r.start_time) as last_reservation_date
FROM computers c
LEFT JOIN reservations r ON c.id = r.computer_id
GROUP BY c.id, c.code, c.description;

-- Índice para la vista materializada
CREATE UNIQUE INDEX idx_mv_computer_usage_stats_id ON mv_computer_usage_stats(id);

-- Función para refrescar vistas materializadas
CREATE OR REPLACE FUNCTION refresh_materialized_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW mv_computer_usage_stats;
END;
$$ LANGUAGE plpgsql;

-- Función para limpiar logs antiguos
CREATE OR REPLACE FUNCTION cleanup_old_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

INSERT INTO computers (code, description, serial_number, hardware_id, created_by, status) VALUES
('PC001', 'Computadora de laboratorio 1', 'SN-PC001-2024', 'HW-001', 1, 'available'),
('PC002', 'Computadora de laboratorio 2', 'SN-PC002-2024', 'HW-002', 1, 'available'),
('PC003', 'Computadora de laboratorio 3', 'SN-PC003-2024', 'HW-003', 1, 'available'); 