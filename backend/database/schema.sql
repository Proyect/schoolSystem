-- Crear base de datos
CREATE DATABASE school_system;

-- Conectar a la base de datos
\c school_system;

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

-- Tabla de computadoras
CREATE TABLE computers (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'available',
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

-- Índices para optimizar consultas
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_computers_code ON computers(code);
CREATE INDEX idx_computers_status ON computers(status);
CREATE INDEX idx_computers_created_by ON computers(created_by);
CREATE INDEX idx_reservations_computer_id ON reservations(computer_id);
CREATE INDEX idx_reservations_user_id ON reservations(user_id);
CREATE INDEX idx_reservations_start_time ON reservations(start_time);
CREATE INDEX idx_reservations_status ON reservations(status);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_computers_updated_at BEFORE UPDATE ON computers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insertar datos de ejemplo
INSERT INTO users (email, password, role, first_name, last_name) VALUES
('admin@school.com', '$2a$10$rQZ8N3YqX2vB5cD7eF9gH.iJ1kL2mN3oP4qR5sT6uV7wX8yZ9aA0bB1cC2d', 'admin', 'Admin', 'User'),
('teacher@school.com', '$2a$10$rQZ8N3YqX2vB5cD7eF9gH.iJ1kL2mN3oP4qR5sT6uV7wX8yZ9aA0bB1cC2d', 'teacher', 'Teacher', 'User'),
('student@school.com', '$2a$10$rQZ8N3YqX2vB5cD7eF9gH.iJ1kL2mN3oP4qR5sT6uV7wX8yZ9aA0bB1cC2d', 'student', 'Student', 'User');

INSERT INTO computers (code, description, created_by) VALUES
('PC001', 'Computadora de laboratorio 1', 1),
('PC002', 'Computadora de laboratorio 2', 1),
('PC003', 'Computadora de laboratorio 3', 1); 