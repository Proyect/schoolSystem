const express = require("express");
const pool = require("../db");

const router = express.Router();

// Obtener todas las computadoras
router.get("/", async (req, res) => {
    const computers = await pool.query("SELECT * FROM computers");
    res.json(computers.rows);
});

// Agregar una nueva computadora
router.post("/", async (req, res) => {
    const { code, description } = req.body;
    const newComputer = await pool.query(
        "INSERT INTO computers (code, description, status) VALUES ($1, $2, 'available') RETURNING *",
        [code, description]
    );
    res.json(newComputer.rows[0]);
});

module.exports = router;
