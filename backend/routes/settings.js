const express = require("express");
const { pool } = require("../db");
const { auth, checkRole } = require("../middleware/auth");
const { auditLogger } = require("../middleware/logging");

const router = express.Router();

// Obtener todas las configuraciones (solo admin)
router.get("/", auth, checkRole(['admin']), auditLogger('VIEW_SETTINGS'), async (req, res) => {
    try {
        const settings = await pool.query(`
            SELECT setting_key, setting_value, setting_type, description, updated_at
            FROM system_settings
            ORDER BY setting_key
        `);
        
        // Convertir a objeto para facilitar el uso en el frontend
        const settingsObject = {};
        settings.rows.forEach(setting => {
            let value = setting.setting_value;
            
            // Convertir tipos
            if (setting.setting_type === 'number') {
                value = parseFloat(value);
            } else if (setting.setting_type === 'boolean') {
                value = value === 'true';
            }
            
            settingsObject[setting.setting_key] = {
                value,
                type: setting.setting_type,
                description: setting.description,
                updated_at: setting.updated_at
            };
        });
        
        res.json(settingsObject);
    } catch (error) {
        console.error('Error obteniendo configuraciones:', error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

// Actualizar una configuración específica (solo admin)
router.put("/:key", auth, checkRole(['admin']), auditLogger('UPDATE_SETTING'), async (req, res) => {
    try {
        const { key } = req.params;
        const { value } = req.body;
        
        if (value === undefined) {
            return res.status(400).json({ error: "Valor requerido" });
        }
        
        // Verificar si la configuración existe
        const existingSetting = await pool.query(
            "SELECT * FROM system_settings WHERE setting_key = $1",
            [key]
        );
        
        if (existingSetting.rowCount === 0) {
            return res.status(404).json({ error: "Configuración no encontrada" });
        }
        
        // Convertir valor según el tipo
        let stringValue = String(value);
        const settingType = existingSetting.rows[0].setting_type;
        
        if (settingType === 'boolean') {
            stringValue = value ? 'true' : 'false';
        } else if (settingType === 'number') {
            if (isNaN(value)) {
                return res.status(400).json({ error: "Valor numérico inválido" });
            }
            stringValue = String(value);
        }
        
        // Actualizar configuración
        await pool.query(`
            UPDATE system_settings 
            SET setting_value = $1, updated_by = $2, updated_at = NOW()
            WHERE setting_key = $3
        `, [stringValue, req.user.id, key]);
        
        res.json({ 
            message: "Configuración actualizada exitosamente",
            key,
            value: settingType === 'number' ? parseFloat(stringValue) : 
                   settingType === 'boolean' ? stringValue === 'true' : stringValue
        });
    } catch (error) {
        console.error('Error actualizando configuración:', error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

// Actualizar múltiples configuraciones (solo admin)
router.put("/", auth, checkRole(['admin']), auditLogger('UPDATE_MULTIPLE_SETTINGS'), async (req, res) => {
    try {
        const { settings } = req.body;
        
        if (!settings || typeof settings !== 'object') {
            return res.status(400).json({ error: "Configuraciones requeridas" });
        }
        
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            
            for (const [key, value] of Object.entries(settings)) {
                // Verificar si la configuración existe
                const existingSetting = await client.query(
                    "SELECT setting_type FROM system_settings WHERE setting_key = $1",
                    [key]
                );
                
                if (existingSetting.rowCount > 0) {
                    const settingType = existingSetting.rows[0].setting_type;
                    let stringValue = String(value);
                    
                    if (settingType === 'boolean') {
                        stringValue = value ? 'true' : 'false';
                    } else if (settingType === 'number') {
                        if (isNaN(value)) {
                            throw new Error(`Valor numérico inválido para ${key}`);
                        }
                        stringValue = String(value);
                    }
                    
                    await client.query(`
                        UPDATE system_settings 
                        SET setting_value = $1, updated_by = $2, updated_at = NOW()
                        WHERE setting_key = $3
                    `, [stringValue, req.user.id, key]);
                }
            }
            
            await client.query('COMMIT');
            res.json({ message: "Configuraciones actualizadas exitosamente" });
            
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
        
    } catch (error) {
        console.error('Error actualizando configuraciones:', error);
        res.status(500).json({ error: error.message || "Error interno del servidor" });
    }
});

// Crear nueva configuración (solo admin)
router.post("/", auth, checkRole(['admin']), auditLogger('CREATE_SETTING'), async (req, res) => {
    try {
        const { setting_key, setting_value, setting_type = 'string', description } = req.body;
        
        if (!setting_key || setting_value === undefined) {
            return res.status(400).json({ error: "Clave y valor de configuración requeridos" });
        }
        
        // Verificar si ya existe
        const existing = await pool.query(
            "SELECT id FROM system_settings WHERE setting_key = $1",
            [setting_key]
        );
        
        if (existing.rowCount > 0) {
            return res.status(400).json({ error: "La configuración ya existe" });
        }
        
        // Validar tipo
        if (!['string', 'number', 'boolean'].includes(setting_type)) {
            return res.status(400).json({ error: "Tipo de configuración inválido" });
        }
        
        const newSetting = await pool.query(`
            INSERT INTO system_settings (setting_key, setting_value, setting_type, description, updated_by)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [setting_key, String(setting_value), setting_type, description, req.user.id]);
        
        res.status(201).json(newSetting.rows[0]);
        
    } catch (error) {
        console.error('Error creando configuración:', error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

// Eliminar configuración (solo admin)
router.delete("/:key", auth, checkRole(['admin']), auditLogger('DELETE_SETTING'), async (req, res) => {
    try {
        const { key } = req.params;
        
        const result = await pool.query(
            "DELETE FROM system_settings WHERE setting_key = $1 RETURNING *",
            [key]
        );
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Configuración no encontrada" });
        }
        
        res.json({ message: "Configuración eliminada exitosamente" });
        
    } catch (error) {
        console.error('Error eliminando configuración:', error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

// Obtener logs de auditoría (solo admin)
router.get("/audit-logs", auth, checkRole(['admin']), async (req, res) => {
    try {
        const { page = 1, limit = 50, action, user_id, start_date, end_date } = req.query;
        const offset = (page - 1) * limit;
        
        let query = `
            SELECT 
                al.*,
                u.email as user_email,
                u.first_name,
                u.last_name
            FROM audit_logs al
            LEFT JOIN users u ON al.user_id = u.id
            WHERE 1=1
        `;
        
        let conditions = [];
        let params = [];
        let paramCount = 0;
        
        if (action) {
            conditions.push(`al.action ILIKE $${++paramCount}`);
            params.push(`%${action}%`);
        }
        
        if (user_id) {
            conditions.push(`al.user_id = $${++paramCount}`);
            params.push(user_id);
        }
        
        if (start_date) {
            conditions.push(`al.created_at >= $${++paramCount}`);
            params.push(start_date);
        }
        
        if (end_date) {
            conditions.push(`al.created_at <= $${++paramCount}`);
            params.push(end_date);
        }
        
        if (conditions.length > 0) {
            query += ` AND ${conditions.join(' AND ')}`;
        }
        
        query += ` ORDER BY al.created_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
        params.push(limit, offset);
        
        const logs = await pool.query(query, params);
        
        // Obtener total para paginación
        let countQuery = `SELECT COUNT(*) FROM audit_logs al WHERE 1=1`;
        if (conditions.length > 0) {
            countQuery += ` AND ${conditions.join(' AND ')}`;
        }
        const countResult = await pool.query(countQuery, params.slice(0, -2));
        
        res.json({
            logs: logs.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: parseInt(countResult.rows[0].count),
                pages: Math.ceil(countResult.rows[0].count / limit)
            }
        });
        
    } catch (error) {
        console.error('Error obteniendo logs de auditoría:', error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

// Obtener estadísticas del sistema (solo admin)
router.get("/system-stats", auth, checkRole(['admin']), async (req, res) => {
    try {
        const stats = await pool.query(`
            SELECT 
                (SELECT COUNT(*) FROM users) as total_users,
                (SELECT COUNT(*) FROM computers) as total_computers,
                (SELECT COUNT(*) FROM reservations WHERE status = 'active') as active_reservations,
                (SELECT COUNT(*) FROM audit_logs WHERE created_at >= NOW() - INTERVAL '24 hours') as logs_24h,
                (SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '30 days') as new_users_30d,
                (SELECT COUNT(*) FROM reservations WHERE created_at >= NOW() - INTERVAL '30 days') as new_reservations_30d
        `);
        
        const systemInfo = {
            version: "1.0.0",
            uptime: process.uptime(),
            memory_usage: process.memoryUsage(),
            node_version: process.version,
            database_connected: true,
            last_backup: null // En un entorno real, esto vendría de la base de datos
        };
        
        res.json({
            stats: stats.rows[0],
            system_info: systemInfo,
            generated_at: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error obteniendo estadísticas del sistema:', error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

module.exports = router;
