const express = require("express");
const bcrypt = require("bcryptjs");
const { pool } = require("../db");
const { auth, checkRole } = require("../middleware/auth");
const { validateUser, validateParams, validateQuery } = require("../middleware/validation");
const { auditLogger } = require("../middleware/logging");

const router = express.Router();

// Obtener todos los usuarios con paginación y filtros (solo admin)
router.get("/", auth, checkRole(['admin']), validateQuery, async (req, res) => {
    try {
        const { page = 1, limit = 10, role, search } = req.query;
        const offset = (page - 1) * limit;
        
        let query = "SELECT id, email, role, first_name, last_name, created_at, updated_at FROM users";
        let conditions = [];
        let params = [];
        let paramCount = 0;
        
        // Filtros
        if (role) {
            conditions.push(`role = $${++paramCount}`);
            params.push(role);
        }
        
        if (search) {
            conditions.push(`(first_name ILIKE $${++paramCount} OR last_name ILIKE $${++paramCount} OR email ILIKE $${++paramCount})`);
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
            paramCount += 2; // Agregamos 2 más porque usamos el mismo parámetro 3 veces
        }
        
        if (conditions.length > 0) {
            query += ` WHERE ${conditions.join(' AND ')}`;
        }
        
        query += ` ORDER BY created_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
        params.push(limit, offset);
        
        const users = await pool.query(query, params);
        
        // Obtener total de registros para paginación
        let countQuery = "SELECT COUNT(*) FROM users";
        if (conditions.length > 0) {
            countQuery += ` WHERE ${conditions.join(' AND ')}`;
        }
        const countResult = await pool.query(countQuery, params.slice(0, -2));
        
        res.json({
            users: users.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: parseInt(countResult.rows[0].count),
                pages: Math.ceil(countResult.rows[0].count / limit)
            }
        });
    } catch (error) {
        console.error('Error obteniendo usuarios:', error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

// Obtener un usuario específico
router.get("/:id", auth, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Solo admins pueden ver cualquier usuario, otros solo pueden verse a sí mismos
        if (req.user.role !== 'admin' && req.user.id !== parseInt(id)) {
            return res.status(403).json({ error: "Acceso denegado" });
        }
        
        const user = await pool.query(
            "SELECT id, email, role, first_name, last_name, created_at, updated_at FROM users WHERE id = $1",
            [id]
        );
        
        if (user.rowCount === 0) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }
        
        res.json(user.rows[0]);
    } catch (error) {
        console.error('Error obteniendo usuario:', error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

// Crear un nuevo usuario (solo admin)
router.post("/", auth, checkRole(['admin']), validateUser, auditLogger('CREATE_USER'), async (req, res) => {
    try {
        const { email, password, first_name, last_name, role = 'student' } = req.body;
        
        // Verificar si el email ya existe
        const existingUser = await pool.query("SELECT id FROM users WHERE email = $1", [email.toLowerCase()]);
        if (existingUser.rowCount > 0) {
            return res.status(400).json({ error: "El email ya está registrado" });
        }
        
        // Encriptar contraseña
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const newUser = await pool.query(`
            INSERT INTO users (email, password, first_name, last_name, role)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, email, role, first_name, last_name, created_at
        `, [email.toLowerCase(), hashedPassword, first_name, last_name, role]);
        
        res.status(201).json(newUser.rows[0]);
    } catch (error) {
        console.error('Error creando usuario:', error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

// Actualizar un usuario
router.put("/:id", auth, validateUser, auditLogger('UPDATE_USER'), async (req, res) => {
    try {
        const { id } = req.params;
        const { email, first_name, last_name, role } = req.body;
        
        // Solo admins pueden actualizar cualquier usuario, otros solo pueden actualizarse a sí mismos
        if (req.user.role !== 'admin' && req.user.id !== parseInt(id)) {
            return res.status(403).json({ error: "Acceso denegado" });
        }
        
        // Solo admins pueden cambiar roles
        if (role && req.user.role !== 'admin') {
            return res.status(403).json({ error: "No tienes permisos para cambiar roles" });
        }
        
        // Verificar si el usuario existe
        const existingUser = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
        if (existingUser.rowCount === 0) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }
        
        // Verificar si el email ya está en uso por otro usuario
        if (email && email !== existingUser.rows[0].email) {
            const emailCheck = await pool.query("SELECT id FROM users WHERE email = $1 AND id != $2", [email.toLowerCase(), id]);
            if (emailCheck.rowCount > 0) {
                return res.status(400).json({ error: "El email ya está en uso" });
            }
        }
        
        // Construir query de actualización dinámicamente
        let updateFields = [];
        let params = [];
        let paramCount = 0;
        
        if (email) {
            updateFields.push(`email = $${++paramCount}`);
            params.push(email.toLowerCase());
        }
        
        if (first_name) {
            updateFields.push(`first_name = $${++paramCount}`);
            params.push(first_name);
        }
        
        if (last_name) {
            updateFields.push(`last_name = $${++paramCount}`);
            params.push(last_name);
        }
        
        if (role && req.user.role === 'admin') {
            updateFields.push(`role = $${++paramCount}`);
            params.push(role);
        }
        
        if (updateFields.length === 0) {
            return res.status(400).json({ error: "No hay campos para actualizar" });
        }
        
        updateFields.push(`updated_at = NOW()`);
        params.push(id);
        
        const query = `
            UPDATE users 
            SET ${updateFields.join(', ')}
            WHERE id = $${++paramCount}
            RETURNING id, email, role, first_name, last_name, updated_at
        `;
        
        const updatedUser = await pool.query(query, params);
        res.json(updatedUser.rows[0]);
    } catch (error) {
        console.error('Error actualizando usuario:', error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

// Cambiar contraseña
router.patch("/:id/password", auth, auditLogger('UPDATE_PASSWORD'), async (req, res) => {
    try {
        const { id } = req.params;
        const { current_password, new_password } = req.body;
        
        // Solo admins pueden cambiar la contraseña de cualquier usuario, otros solo la suya
        if (req.user.role !== 'admin' && req.user.id !== parseInt(id)) {
            return res.status(403).json({ error: "Acceso denegado" });
        }
        
        if (!new_password || new_password.length < 6) {
            return res.status(400).json({ error: "La nueva contraseña debe tener al menos 6 caracteres" });
        }
        
        // Obtener usuario
        const user = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
        if (user.rowCount === 0) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }
        
        // Si no es admin, verificar contraseña actual
        if (req.user.role !== 'admin') {
            if (!current_password) {
                return res.status(400).json({ error: "Contraseña actual requerida" });
            }
            
            const validPassword = await bcrypt.compare(current_password, user.rows[0].password);
            if (!validPassword) {
                return res.status(400).json({ error: "Contraseña actual incorrecta" });
            }
        }
        
        // Encriptar nueva contraseña
        const hashedPassword = await bcrypt.hash(new_password, 10);
        
        await pool.query(
            "UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2",
            [hashedPassword, id]
        );
        
        res.json({ message: "Contraseña actualizada exitosamente" });
    } catch (error) {
        console.error('Error actualizando contraseña:', error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

// Eliminar usuario (solo admin)
router.delete("/:id", auth, checkRole(['admin']), auditLogger('DELETE_USER'), async (req, res) => {
    try {
        const { id } = req.params;
        
        // No permitir que el admin se elimine a sí mismo
        if (req.user.id === parseInt(id)) {
            return res.status(400).json({ error: "No puedes eliminar tu propia cuenta" });
        }
        
        const user = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
        if (user.rowCount === 0) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }
        
        await pool.query("DELETE FROM users WHERE id = $1", [id]);
        res.json({ message: "Usuario eliminado exitosamente" });
    } catch (error) {
        console.error('Error eliminando usuario:', error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

// Obtener estadísticas de usuarios (solo admin)
router.get("/stats/overview", auth, checkRole(['admin']), async (req, res) => {
    try {
        const stats = await pool.query(`
            SELECT 
                role,
                COUNT(*) as count
            FROM users 
            GROUP BY role
            ORDER BY role
        `);
        
        const totalUsers = await pool.query("SELECT COUNT(*) as total FROM users");
        const recentUsers = await pool.query(`
            SELECT COUNT(*) as recent 
            FROM users 
            WHERE created_at >= NOW() - INTERVAL '30 days'
        `);
        
        res.json({
            total: parseInt(totalUsers.rows[0].total),
            recent: parseInt(recentUsers.rows[0].recent),
            by_role: stats.rows
        });
    } catch (error) {
        console.error('Error obteniendo estadísticas:', error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

module.exp