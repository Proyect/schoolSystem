const express = require("express");
const { pool } = require("../db");
const { auth, checkRole } = require("../middleware/auth");
const { validateComputer, validateParams, validateQuery } = require("../middleware/validation");
const { auditLogger } = require("../middleware/logging");
const {
  COMPUTER_STATUSES,
  STATUS_TRANSITIONS,
  isValidStatus,
  getPossibleNextStatuses,
  canTransitionFromTo
} = require("../constants/computerStatus");

const router = express.Router();

// Listar estados posibles y transiciones (para el frontend)
router.get("/statuses", auth, (req, res) => {
  const statusesWithLabels = [
    { value: 'available', label: 'Disponible' },
    { value: 'in_use', label: 'En uso' },
    { value: 'maintenance', label: 'En mantenimiento' },
    { value: 'out_of_service', label: 'Fuera de servicio' }
  ];
  res.json({
    statuses: COMPUTER_STATUSES,
    statusesWithLabels,
    transitions: STATUS_TRANSITIONS,
    getPossibleNextStatuses: (current) => getPossibleNextStatuses(current)
  });
});

// Obtener todas las computadoras con paginación (requiere autenticación)
router.get("/", auth, validateQuery, async (req, res) => {
    try {
        const { page = 1, limit = 10, status } = req.query;
        const offset = (page - 1) * limit;
        
        let query = "SELECT * FROM computers";
        let params = [];
        
        if (status) {
            query += " WHERE status = $1";
            params.push(status);
        }
        
        query += " ORDER BY created_at DESC LIMIT $" + (params.length + 1) + " OFFSET $" + (params.length + 2);
        params.push(limit, offset);
        
        const computers = await pool.query(query, params);
        
        // Obtener total de registros para paginación
        let countQuery = "SELECT COUNT(*) FROM computers";
        if (status) {
            countQuery += " WHERE status = $1";
        }
        const countResult = await pool.query(countQuery, status ? [status] : []);
        
        res.json({
            computers: computers.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: parseInt(countResult.rows[0].count),
                pages: Math.ceil(countResult.rows[0].count / limit)
            }
        });
    } catch (error) {
        console.error('Error obteniendo computadoras:', error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

// Obtener una computadora específica (requiere autenticación)
router.get("/:id", auth, validateParams, async (req, res) => {
    try {
        const { id } = req.params;
        const computer = await pool.query("SELECT * FROM computers WHERE id = $1", [id]);
        
        if (computer.rowCount === 0) {
            return res.status(404).json({ error: "Computadora no encontrada" });
        }
        
        res.json(computer.rows[0]);
    } catch (error) {
        console.error('Error obteniendo computadora:', error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

// Agregar una nueva computadora (requiere autenticación)
router.post("/", auth, checkRole(['admin', 'teacher']), validateComputer, auditLogger('CREATE_COMPUTER'), async (req, res) => {
    try {
        const { code, description, serial_number, hardware_id } = req.body;
        
        // Verificar si el código ya existe
        const existingComputer = await pool.query("SELECT id FROM computers WHERE code = $1", [code]);
        if (existingComputer.rowCount > 0) {
            return res.status(400).json({ error: "El código de computadora ya existe" });
        }
        
        const newComputer = await pool.query(
            "INSERT INTO computers (code, description, serial_number, hardware_id, status, created_by) VALUES ($1, $2, $3, $4, 'available', $5) RETURNING *",
            [code, description, serial_number || null, hardware_id || null, req.user.id]
        );
        
        res.status(201).json(newComputer.rows[0]);
    } catch (error) {
        console.error('Error creando computadora:', error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

// Actualizar computadora (descripción, número de serie, id hardware)
router.patch("/:id", auth, checkRole(['admin', 'teacher']), validateParams, auditLogger('UPDATE_COMPUTER'), async (req, res) => {
    try {
        const { id } = req.params;
        const { description, serial_number, hardware_id } = req.body;
        const updates = [];
        const params = [];
        let idx = 1;
        if (description !== undefined) {
            if (typeof description !== 'string' || description.length < 5 || description.length > 255) {
                return res.status(400).json({ error: "La descripción debe tener entre 5 y 255 caracteres" });
            }
            updates.push(`description = $${idx++}`);
            params.push(description.trim());
        }
        if (serial_number !== undefined) {
            if (serial_number !== null && (typeof serial_number !== 'string' || serial_number.length > 100)) {
                return res.status(400).json({ error: "Número de serie debe ser texto de hasta 100 caracteres" });
            }
            updates.push(`serial_number = $${idx++}`);
            params.push(serial_number ? serial_number.trim() : null);
        }
        if (hardware_id !== undefined) {
            if (hardware_id !== null && (typeof hardware_id !== 'string' || hardware_id.length > 100)) {
                return res.status(400).json({ error: "ID de hardware debe ser texto de hasta 100 caracteres" });
            }
            updates.push(`hardware_id = $${idx++}`);
            params.push(hardware_id ? hardware_id.trim() : null);
        }
        if (updates.length === 0) {
            return res.status(400).json({ error: "Incluya al menos un campo a actualizar: description, serial_number, hardware_id" });
        }
        updates.push(`updated_at = NOW()`);
        params.push(id);
        const computer = await pool.query(
            `UPDATE computers SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
            params
        );
        if (computer.rowCount === 0) {
            return res.status(404).json({ error: "Computadora no encontrada" });
        }
        res.json(computer.rows[0]);
    } catch (error) {
        console.error('Error actualizando computadora:', error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

// Actualizar estado de computadora (solo transiciones permitidas)
router.patch("/:id/status", auth, validateParams, auditLogger('UPDATE_COMPUTER_STATUS'), async (req, res) => {
    try {
        const { id } = req.params;
        const { status: newStatus } = req.body;
        
        if (!isValidStatus(newStatus)) {
            return res.status(400).json({ error: "Estado inválido. Estados permitidos: " + COMPUTER_STATUSES.join(', ') });
        }
        
        const current = await pool.query("SELECT status FROM computers WHERE id = $1", [id]);
        if (current.rowCount === 0) {
            return res.status(404).json({ error: "Computadora no encontrada" });
        }
        const currentStatus = current.rows[0].status;
        if (!canTransitionFromTo(currentStatus, newStatus)) {
            const allowed = getPossibleNextStatuses(currentStatus);
            return res.status(400).json({
                error: "Transición no permitida",
                detail: `Desde "${currentStatus}" solo se puede cambiar a: ${allowed.join(', ')}`
            });
        }
        
        const computer = await pool.query(
            "UPDATE computers SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
            [newStatus, id]
        );
        
        if (computer.rowCount === 0) {
            return res.status(404).json({ error: "Computadora no encontrada" });
        }
        
        res.json(computer.rows[0]);
    } catch (error) {
        console.error('Error actualizando computadora:', error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

// Eliminar computadora (solo admin)
router.delete("/:id", auth, checkRole(['admin']), validateParams, auditLogger('DELETE_COMPUTER'), async (req, res) => {
    try {
        const { id } = req.params;
        const computer = await pool.query("DELETE FROM computers WHERE id = $1 RETURNING *", [id]);
        
        if (computer.rowCount === 0) {
            return res.status(404).json({ error: "Computadora no encontrada" });
        }
        
        res.json({ message: "Computadora eliminada exitosamente" });
    } catch (error) {
        console.error('Error eliminando computadora:', error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

module.exports = router;
