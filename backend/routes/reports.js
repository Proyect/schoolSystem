const express = require("express");
const { pool } = require("../db");
const { auth, checkRole } = require("../middleware/auth");
const logger = require("../lib/logger");

const router = express.Router();

// Reporte general de computadoras
router.get("/computers", auth, checkRole(['admin', 'teacher']), async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        
        // Estadísticas generales
        const generalStats = await pool.query(`
            SELECT 
                COUNT(*) as total_computers,
                COUNT(CASE WHEN status = 'available' THEN 1 END) as available,
                COUNT(CASE WHEN status = 'in_use' THEN 1 END) as in_use,
                COUNT(CASE WHEN status = 'maintenance' THEN 1 END) as maintenance,
                COUNT(CASE WHEN status = 'out_of_service' THEN 1 END) as out_of_service
            FROM computers
        `);
        
        // Computadoras más utilizadas
        let mostUsedQuery = `
            SELECT 
                c.id,
                c.code,
                c.description,
                COUNT(r.id) as reservation_count,
                COALESCE(SUM(EXTRACT(EPOCH FROM (r.end_time - r.start_time))/3600), 0) as total_hours
            FROM computers c
            LEFT JOIN reservations r ON c.id = r.computer_id AND r.status != 'cancelled'
        `;
        
        let params = [];
        if (start_date && end_date) {
            mostUsedQuery += ` AND r.start_time >= $1 AND r.end_time <= $2`;
            params.push(start_date, end_date);
        }
        
        mostUsedQuery += `
            GROUP BY c.id, c.code, c.description
            ORDER BY reservation_count DESC, total_hours DESC
            LIMIT 10
        `;
        
        const mostUsed = await pool.query(mostUsedQuery, params);
        
        // Uso por día de la semana
        let weeklyUsageQuery = `
            SELECT 
                EXTRACT(DOW FROM r.start_time) as day_of_week,
                COUNT(r.id) as reservation_count,
                COALESCE(SUM(EXTRACT(EPOCH FROM (r.end_time - r.start_time))/3600), 0) as total_hours
            FROM reservations r
            WHERE r.status != 'cancelled'
        `;
        
        if (start_date && end_date) {
            weeklyUsageQuery += ` AND r.start_time >= $1 AND r.end_time <= $2`;
        }
        
        weeklyUsageQuery += `
            GROUP BY EXTRACT(DOW FROM r.start_time)
            ORDER BY day_of_week
        `;
        
        const weeklyUsage = await pool.query(weeklyUsageQuery, params);
        
        // Uso por hora del día
        let hourlyUsageQuery = `
            SELECT 
                EXTRACT(HOUR FROM r.start_time) as hour,
                COUNT(r.id) as reservation_count
            FROM reservations r
            WHERE r.status != 'cancelled'
        `;
        
        if (start_date && end_date) {
            hourlyUsageQuery += ` AND r.start_time >= $1 AND r.end_time <= $2`;
        }
        
        hourlyUsageQuery += `
            GROUP BY EXTRACT(HOUR FROM r.start_time)
            ORDER BY hour
        `;
        
        const hourlyUsage = await pool.query(hourlyUsageQuery, params);
        
        res.json({
            period: { start_date, end_date },
            general_stats: generalStats.rows[0],
            most_used_computers: mostUsed.rows,
            weekly_usage: weeklyUsage.rows,
            hourly_usage: hourlyUsage.rows
        });
    } catch (error) {
        logger.error({ msg: 'Error generando reporte de computadoras', err: error.message });
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

// Reporte de reservas
router.get("/reservations", auth, checkRole(['admin', 'teacher']), async (req, res) => {
    try {
        const { start_date, end_date, user_id, computer_id } = req.query;
        
        let baseQuery = `
            FROM reservations r
            JOIN computers c ON r.computer_id = c.id
            JOIN users u ON r.user_id = u.id
            WHERE 1=1
        `;
        
        let conditions = [];
        let params = [];
        let paramCount = 0;
        
        if (start_date) {
            conditions.push(`r.start_time >= $${++paramCount}`);
            params.push(start_date);
        }
        
        if (end_date) {
            conditions.push(`r.end_time <= $${++paramCount}`);
            params.push(end_date);
        }
        
        if (user_id) {
            conditions.push(`r.user_id = $${++paramCount}`);
            params.push(user_id);
        }
        
        if (computer_id) {
            conditions.push(`r.computer_id = $${++paramCount}`);
            params.push(computer_id);
        }
        
        if (conditions.length > 0) {
            baseQuery += ` AND ${conditions.join(' AND ')}`;
        }
        
        // Estadísticas generales
        const generalStats = await pool.query(`
            SELECT 
                COUNT(*) as total_reservations,
                COUNT(CASE WHEN r.status = 'active' THEN 1 END) as active,
                COUNT(CASE WHEN r.status = 'completed' THEN 1 END) as completed,
                COUNT(CASE WHEN r.status = 'cancelled' THEN 1 END) as cancelled,
                COALESCE(AVG(EXTRACT(EPOCH FROM (r.end_time - r.start_time))/3600), 0) as avg_duration_hours,
                COALESCE(SUM(EXTRACT(EPOCH FROM (r.end_time - r.start_time))/3600), 0) as total_hours
            ${baseQuery}
        `, params);
        
        // Usuarios más activos
        const activeUsers = await pool.query(`
            SELECT 
                u.id,
                u.first_name,
                u.last_name,
                u.email,
                u.role,
                COUNT(r.id) as reservation_count,
                COALESCE(SUM(EXTRACT(EPOCH FROM (r.end_time - r.start_time))/3600), 0) as total_hours
            ${baseQuery}
            GROUP BY u.id, u.first_name, u.last_name, u.email, u.role
            ORDER BY reservation_count DESC, total_hours DESC
            LIMIT 10
        `, params);
        
        // Reservas por día
        const dailyReservations = await pool.query(`
            SELECT 
                DATE(r.start_time) as date,
                COUNT(r.id) as reservation_count,
                COALESCE(SUM(EXTRACT(EPOCH FROM (r.end_time - r.start_time))/3600), 0) as total_hours
            ${baseQuery}
            GROUP BY DATE(r.start_time)
            ORDER BY date DESC
            LIMIT 30
        `, params);
        
        res.json({
            period: { start_date, end_date },
            filters: { user_id, computer_id },
            general_stats: generalStats.rows[0],
            active_users: activeUsers.rows,
            daily_reservations: dailyReservations.rows
        });
    } catch (error) {
        logger.error({ msg: 'Error generando reporte de reservas', err: error.message });
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

// Reporte de usuarios
router.get("/users", auth, checkRole(['admin']), async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        
        // Estadísticas generales de usuarios
        const userStats = await pool.query(`
            SELECT 
                role,
                COUNT(*) as count,
                COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as recent_count
            FROM users
            GROUP BY role
            ORDER BY role
        `);
        
        // Usuarios más activos en reservas
        let activeUsersQuery = `
            SELECT 
                u.id,
                u.first_name,
                u.last_name,
                u.email,
                u.role,
                u.created_at,
                COUNT(r.id) as reservation_count,
                COALESCE(SUM(EXTRACT(EPOCH FROM (r.end_time - r.start_time))/3600), 0) as total_hours,
                MAX(r.start_time) as last_reservation
            FROM users u
            LEFT JOIN reservations r ON u.id = r.user_id AND r.status != 'cancelled'
        `;
        
        let params = [];
        if (start_date && end_date) {
            activeUsersQuery += ` AND r.start_time >= $1 AND r.end_time <= $2`;
            params.push(start_date, end_date);
        }
        
        activeUsersQuery += `
            GROUP BY u.id, u.first_name, u.last_name, u.email, u.role, u.created_at
            ORDER BY reservation_count DESC, total_hours DESC
            LIMIT 20
        `;
        
        const activeUsers = await pool.query(activeUsersQuery, params);
        
        // Registros de usuarios por mes
        const monthlyRegistrations = await pool.query(`
            SELECT 
                DATE_TRUNC('month', created_at) as month,
                role,
                COUNT(*) as registrations
            FROM users
            WHERE created_at >= NOW() - INTERVAL '12 months'
            GROUP BY DATE_TRUNC('month', created_at), role
            ORDER BY month DESC, role
        `);
        
        res.json({
            period: { start_date, end_date },
            user_stats: userStats.rows,
            active_users: activeUsers.rows,
            monthly_registrations: monthlyRegistrations.rows
        });
    } catch (error) {
        logger.error({ msg: 'Error generando reporte de usuarios', err: error.message });
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

// Dashboard de métricas en tiempo real
router.get("/dashboard", auth, checkRole(['admin', 'teacher']), async (req, res) => {
    try {
        // Estadísticas de hoy
        const today = new Date().toISOString().split('T')[0];
        
        const todayStats = await pool.query(`
            SELECT 
                COUNT(CASE WHEN r.status = 'active' AND DATE(r.start_time) = $1 THEN 1 END) as active_reservations_today,
                COUNT(CASE WHEN r.status = 'completed' AND DATE(r.start_time) = $1 THEN 1 END) as completed_reservations_today,
                COUNT(CASE WHEN DATE(r.created_at) = $1 THEN 1 END) as new_reservations_today,
                COALESCE(SUM(CASE WHEN DATE(r.start_time) = $1 THEN EXTRACT(EPOCH FROM (r.end_time - r.start_time))/3600 END), 0) as hours_used_today
            FROM reservations r
        `, [today]);
        
        // Estado actual de computadoras
        const computerStatus = await pool.query(`
            SELECT 
                status,
                COUNT(*) as count
            FROM computers
            GROUP BY status
        `);
        
        // Próximas reservas (próximas 4 horas)
        const upcomingReservations = await pool.query(`
            SELECT 
                r.id,
                r.start_time,
                r.end_time,
                c.code as computer_code,
                u.first_name,
                u.last_name
            FROM reservations r
            JOIN computers c ON r.computer_id = c.id
            JOIN users u ON r.user_id = u.id
            WHERE r.status = 'active'
            AND r.start_time BETWEEN NOW() AND NOW() + INTERVAL '4 hours'
            ORDER BY r.start_time
            LIMIT 10
        `);
        
        // Uso de la semana actual
        const weeklyUsage = await pool.query(`
            SELECT 
                DATE(r.start_time) as date,
                COUNT(r.id) as reservations,
                COALESCE(SUM(EXTRACT(EPOCH FROM (r.end_time - r.start_time))/3600), 0) as hours
            FROM reservations r
            WHERE r.start_time >= DATE_TRUNC('week', NOW())
            AND r.start_time < DATE_TRUNC('week', NOW()) + INTERVAL '1 week'
            AND r.status != 'cancelled'
            GROUP BY DATE(r.start_time)
            ORDER BY date
        `);
        
        res.json({
            today_stats: todayStats.rows[0],
            computer_status: computerStatus.rows,
            upcoming_reservations: upcomingReservations.rows,
            weekly_usage: weeklyUsage.rows,
            generated_at: new Date().toISOString()
        });
    } catch (error) {
        logger.error({ msg: 'Error generando dashboard', err: error.message });
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

// Exportar datos para Excel/CSV
router.get("/export/:type", auth, checkRole(['admin', 'teacher']), async (req, res) => {
    try {
        const { type } = req.params;
        const { start_date, end_date, format = 'json' } = req.query;
        
        let query;
        let params = [];
        
        switch (type) {
            case 'reservations':
                query = `
                    SELECT 
                        r.id,
                        r.start_time,
                        r.end_time,
                        r.status,
                        r.created_at,
                        c.code as computer_code,
                        c.description as computer_description,
                        u.first_name,
                        u.last_name,
                        u.email,
                        u.role,
                        EXTRACT(EPOCH FROM (r.end_time - r.start_time))/3600 as duration_hours
                    FROM reservations r
                    JOIN computers c ON r.computer_id = c.id
                    JOIN users u ON r.user_id = u.id
                    WHERE 1=1
                `;
                
                if (start_date) {
                    query += ` AND r.start_time >= $${params.length + 1}`;
                    params.push(start_date);
                }
                
                if (end_date) {
                    query += ` AND r.end_time <= $${params.length + 1}`;
                    params.push(end_date);
                }
                
                query += ` ORDER BY r.start_time DESC`;
                break;
                
            case 'computers':
                query = `
                    SELECT 
                        c.*,
                        COALESCE(COUNT(r.id), 0) as total_reservations,
                        COALESCE(SUM(EXTRACT(EPOCH FROM (r.end_time - r.start_time))/3600), 0) as total_hours_used
                    FROM computers c
                    LEFT JOIN reservations r ON c.id = r.computer_id AND r.status != 'cancelled'
                `;
                
                if (start_date || end_date) {
                    query += ` WHERE 1=1`;
                    if (start_date) {
                        query += ` AND (r.start_time IS NULL OR r.start_time >= $${params.length + 1})`;
                        params.push(start_date);
                    }
                    if (end_date) {
                        query += ` AND (r.end_time IS NULL OR r.end_time <= $${params.length + 1})`;
                        params.push(end_date);
                    }
                }
                
                query += ` GROUP BY c.id ORDER BY c.code`;
                break;
                
            case 'users':
                if (req.user.role !== 'admin') {
                    return res.status(403).json({ error: "Acceso denegado" });
                }
                
                query = `
                    SELECT 
                        u.id,
                        u.email,
                        u.first_name,
                        u.last_name,
                        u.role,
                        u.created_at,
                        COALESCE(COUNT(r.id), 0) as total_reservations,
                        COALESCE(SUM(EXTRACT(EPOCH FROM (r.end_time - r.start_time))/3600), 0) as total_hours_reserved
                    FROM users u
                    LEFT JOIN reservations r ON u.id = r.user_id AND r.status != 'cancelled'
                `;
                
                if (start_date || end_date) {
                    query += ` WHERE 1=1`;
                    if (start_date) {
                        query += ` AND (r.start_time IS NULL OR r.start_time >= $${params.length + 1})`;
                        params.push(start_date);
                    }
                    if (end_date) {
                        query += ` AND (r.end_time IS NULL OR r.end_time <= $${params.length + 1})`;
                        params.push(end_date);
                    }
                }
                
                query += ` GROUP BY u.id ORDER BY u.created_at DESC`;
                break;
                
            default:
                return res.status(400).json({ error: "Tipo de exportación inválido" });
        }
        
        const result = await pool.query(query, params);
        
        // En un entorno real, aquí podrías formatear como CSV o Excel
        if (format === 'csv') {
            // TODO: Implementar conversión a CSV
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="${type}_export.csv"`);
        }
        
        res.json({
            type,
            period: { start_date, end_date },
            data: result.rows,
            exported_at: new Date().toISOString(),
            count: result.rowCount
        });
    } catch (error) {
        logger.error({ msg: 'Error exportando datos', err: error.message });
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

module.exports = router;
