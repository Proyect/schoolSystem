const express = require("express");
const pool = require("../db");
const { auth, checkRole } = require("../middleware/auth");
const { validateComputer } = require("../middleware/validation");

const router = express.Router();

// Obtener todas las computadoras con paginación
router.get("/", async (req, res) => {
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

// Obtener una computadora específica
router.get("/:id", async (req, res) => {
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
router.post("/", auth, checkRole(['admin', 'teacher']), validateComputer, async (req, res) => {
    try {
        const { code, description } = req.body;
        
        // Verificar si el código ya existe
        const existingComputer = await pool.query("SELECT id FROM computers WHERE code = $1", [code]);
        if (existingComputer.rowCount > 0) {
            return res.status(400).json({ error: "El código de computadora ya existe" });
        }
        
        const newComputer = await pool.query(
            "INSERT INTO computers (code, description, status, created_by) VALUES ($1, $2, 'available', $3) RETURNING *",
            [code, description, req.user.id]
        );
        
        res.status(201).json(newComputer.rows[0]);
    } catch (error) {
        console.error('Error creando computadora:', error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

// Actualizar estado de computadora
router.patch("/:id/status", auth, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        
        if (!['available', 'in_use', 'maintenance'].includes(status)) {
            return res.status(400).json({ error: "Estado inválido" });
        }
        
        const computer = await pool.query(
            "UPDATE computers SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
            [status, id]
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
router.delete("/:id", auth, checkRole(['admin']), async (req, res) => {
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
