const express = require("express");
const { pool } = require("../db");
const { auth, checkRole } = require("../middleware/auth");
const { validateReservation } = require("../middleware/validation");
const { auditLogger } = require("../middleware/logging");

const router = express.Router();

// Obtener todas las reservas con paginación y filtros
router.get("/", auth, async (req, res) => {
    try {
        const { page = 1, limit = 10, status, user_id, computer_id, date } = req.query;
        const offset = (page - 1) * limit;
        
        let query = `
            SELECT 
                r.*,
                c.code as computer_code,
                c.description as computer_description,
                u.first_name,
                u.last_name,
                u.email
            FROM reservations r
            JOIN computers c ON r.computer_id = c.id
            JOIN users u ON r.user_id = u.id
        `;
        
        let conditions = [];
        let params = [];
        let paramCount = 0;
        
        // Filtros
        if (status) {
            conditions.push(`r.status = $${++paramCount}`);
            params.push(status);
        }
        
        if (user_id) {
            conditions.push(`r.user_id = $${++paramCount}`);
            params.push(user_id);
        }
        
        if (computer_id) {
            conditions.push(`r.computer_id = $${++paramCount}`);
            params.push(computer_id);
        }
        
        if (date) {
            conditions.push(`DATE(r.start_time) = $${++paramCount}`);
            params.push(date);
        }
        
        // Si no es admin, solo ver sus propias reservas (estudiantes)
        if (req.user.role === 'student') {
            conditions.push(`r.user_id = $${++paramCount}`);
            params.push(req.user.id);
        }
        
        if (conditions.length > 0) {
            query += ` WHERE ${conditions.join(' AND ')}`;
        }
        
        query += ` ORDER BY r.start_time DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
        params.push(limit, offset);
        
        const reservations = await pool.query(query, params);
        
        // Obtener total de registros para paginación
        let countQuery = `SELECT COUNT(*) FROM reservations r`;
        if (conditions.length > 0) {
            countQuery += ` WHERE ${conditions.join(' AND ').replace(/LIMIT.*OFFSET.*/, '')}`;
        }
        const countResult = await pool.query(countQuery, params.slice(0, -2));
        
        res.json({
            reservations: reservations.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: parseInt(countResult.rows[0].count),
                pages: Math.ceil(countResult.rows[0].count / limit)
            }
        });
    } catch (error) {
        console.error('Error obteniendo reservas:', error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

// Obtener una reserva específica
router.get("/:id", auth, async (req, res) => {
    try {
        const { id } = req.params;
        
        let query = `
            SELECT 
                r.*,
                c.code as computer_code,
                c.description as computer_description,
                u.first_name,
                u.last_name,
                u.email
            FROM reservations r
            JOIN computers c ON r.computer_id = c.id
            JOIN users u ON r.user_id = u.id
            WHERE r.id = $1
        `;
        
        // Si no es admin o teacher, solo puede ver sus propias reservas
        if (req.user.role === 'student') {
            query += ` AND r.user_id = $2`;
        }
        
        const params = req.user.role === 'student' ? [id, req.user.id] : [id];
        const reservation = await pool.query(query, params);
        
        if (reservation.rowCount === 0) {
            return res.status(404).json({ error: "Reserva no encontrada" });
        }
        
        res.json(reservation.rows[0]);
    } catch (error) {
        console.error('Error obteniendo reserva:', error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

// Crear una nueva reserva
router.post("/", auth, validateReservation, auditLogger('CREATE_RESERVATION'), async (req, res) => {
    try {
        const { computer_id, start_time, end_time } = req.body;
        const user_id = req.user.id;
        
        // Verificar si la computadora existe y está disponible
        const computer = await pool.query(
            "SELECT * FROM computers WHERE id = $1 AND status = 'available'",
            [computer_id]
        );
        
        if (computer.rowCount === 0) {
            return res.status(400).json({ error: "Computadora no disponible" });
        }
        
        // Verificar conflictos de horario
        const conflicts = await pool.query(`
            SELECT * FROM reservations 
            WHERE computer_id = $1 
            AND status = 'active'
            AND (
                (start_time <= $2 AND end_time > $2) OR
                (start_time < $3 AND end_time >= $3) OR
                (start_time >= $2 AND end_time <= $3)
            )
        `, [computer_id, start_time, end_time]);
        
        if (conflicts.rowCount > 0) {
            return res.status(400).json({ error: "La computadora ya está reservada en ese horario" });
        }
        
        // Crear la reserva
        const newReservation = await pool.query(`
            INSERT INTO reservations (computer_id, user_id, start_time, end_time, status)
            VALUES ($1, $2, $3, $4, 'active')
            RETURNING *
        `, [computer_id, user_id, start_time, end_time]);
        
        // Actualizar estado de la computadora si la reserva es inmediata
        const now = new Date();
        const reservationStart = new Date(start_time);
        
        if (reservationStart <= now) {
            await pool.query(
                "UPDATE computers SET status = 'in_use' WHERE id = $1",
                [computer_id]
            );
        }
        
        res.status(201).json(newReservation.rows[0]);
    } catch (error) {
        console.error('Error creando reserva:', error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

// Actualizar estado de reserva
router.patch("/:id/status", auth, auditLogger('UPDATE_RESERVATION_STATUS'), async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        
        if (!['active', 'completed', 'cancelled'].includes(status)) {
            return res.status(400).json({ error: "Estado inválido" });
        }
        
        // Verificar permisos
        let query = "SELECT * FROM reservations WHERE id = $1";
        let params = [id];
        
        if (req.user.role === 'student') {
            query += " AND user_id = $2";
            params.push(req.user.id);
        }
        
        const existingReservation = await pool.query(query, params);
        
        if (existingReservation.rowCount === 0) {
            return res.status(404).json({ error: "Reserva no encontrada" });
        }
        
        const reservation = existingReservation.rows[0];
        
        // Actualizar reserva
        const updatedReservation = await pool.query(`
            UPDATE reservations 
            SET status = $1 
            WHERE id = $2 
            RETURNING *
        `, [status, id]);
        
        // Actualizar estado de computadora si es necesario
        if (status === 'completed' || status === 'cancelled') {
            await pool.query(
                "UPDATE computers SET status = 'available' WHERE id = $1",
                [reservation.computer_id]
            );
        }
        
        res.json(updatedReservation.rows[0]);
    } catch (error) {
        console.error('Error actualizando reserva:', error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

// Eliminar reserva (solo admins)
router.delete("/:id", auth, checkRole(['admin']), auditLogger('DELETE_RESERVATION'), async (req, res) => {
    try {
        const { id } = req.params;
        
        const reservation = await pool.query("SELECT * FROM reservations WHERE id = $1", [id]);
        
        if (reservation.rowCount === 0) {
            return res.status(404).json({ error: "Reserva no encontrada" });
        }
        
        await pool.query("DELETE FROM reservations WHERE id = $1", [id]);
        
        // Liberar computadora si estaba en uso
        if (reservation.rows[0].status === 'active') {
            await pool.query(
                "UPDATE computers SET status = 'available' WHERE id = $1",
                [reservation.rows[0].computer_id]
            );
        }
        
        res.json({ message: "Reserva eliminada exitosamente" });
    } catch (error) {
        console.error('Error eliminando reserva:', error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

// Obtener horarios disponibles para una computadora en una fecha
router.get("/computers/:computer_id/availability", auth, async (req, res) => {
    try {
        const { computer_id } = req.params;
        const { date } = req.query;
        
        if (!date) {
            return res.status(400).json({ error: "Fecha requerida" });
        }
        
        // Verificar si la computadora existe
        const computer = await pool.query("SELECT * FROM computers WHERE id = $1", [computer_id]);
        
        if (computer.rowCount === 0) {
            return res.status(404).json({ error: "Computadora no encontrada" });
        }
        
        // Obtener reservas activas para esa fecha
        const reservations = await pool.query(`
            SELECT start_time, end_time 
            FROM reservations 
            WHERE computer_id = $1 
            AND DATE(start_time) = $2 
            AND status = 'active'
            ORDER BY start_time
        `, [computer_id, date]);
        
        res.json({
            computer: computer.rows[0],
            date,
            reservations: reservations.rows
        });
    } catch (error) {
        console.error('Error obteniendo disponibilidad:', error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

module.exports = router;
