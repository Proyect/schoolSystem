const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool } = require("../db");
const { validateLogin } = require("../middleware/validation");
const { logAuditFromRequest } = require("../middleware/logging");
const logger = require("../lib/logger");

const router = express.Router();

// Login optimizado con manejo de errores y auditoría
router.post("/login", validateLogin, async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await pool.query(
            "SELECT id, email, password, role FROM users WHERE email = $1",
            [email.toLowerCase()]
        );

        if (user.rowCount === 0) {
            await logAuditFromRequest(req, "login_failure", 400, { details: { reason: "user_not_found", email } });
            return res.status(400).json({ error: "Usuario no encontrado" });
        }

        const validPassword = await bcrypt.compare(password, user.rows[0].password);
        if (!validPassword) {
            await logAuditFromRequest(req, "login_failure", 400, { details: { reason: "invalid_password", email } });
            return res.status(400).json({ error: "Contraseña incorrecta" });
        }

        const token = jwt.sign(
            { 
                id: user.rows[0].id, 
                role: user.rows[0].role,
                email: user.rows[0].email 
            }, 
            process.env.JWT_SECRET, 
            { expiresIn: "24h" }
        );

        await logAuditFromRequest(req, "login_success", 200, { userId: user.rows[0].id });

        res.json({ 
            token,
            user: {
                id: user.rows[0].id,
                email: user.rows[0].email,
                role: user.rows[0].role
            }
        });
    } catch (error) {
        logger.error({ msg: "Error en login", err: error.message });
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

// Ruta para verificar token
router.get("/verify", async (req, res) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ error: 'Token requerido' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        res.json({ valid: true, user: decoded });
    } catch (error) {
        res.status(401).json({ error: 'Token inválido' });
    }
});

module.exports = router;
