-- Migración: agregar número de serie e ID de hardware a computadoras
-- Ejecutar en bases existentes: psql -U postgres -d school_system -f database/migrations/001_add_serial_hardware_to_computers.sql

ALTER TABLE computers ADD COLUMN IF NOT EXISTS serial_number VARCHAR(100);
ALTER TABLE computers ADD COLUMN IF NOT EXISTS hardware_id VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_computers_serial_number ON computers(serial_number);
CREATE INDEX IF NOT EXISTS idx_computers_hardware_id ON computers(hardware_id);
