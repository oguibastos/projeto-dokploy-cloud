const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

app.get("/", (req, res) => {
  res.json({
    message: "Backend do Projeto Cloud com Dokploy funcionando!",
  });
});

app.get("/tarefas", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM tarefas ORDER BY id DESC");
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar tarefas" });
  }
});

app.post("/tarefas", async (req, res) => {
  const { titulo } = req.body;

  if (!titulo) {
    return res.status(400).json({ error: "Título é obrigatório" });
  }

  try {
    const result = await pool.query(
      "INSERT INTO tarefas (titulo) VALUES ($1) RETURNING *",
      [titulo]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: "Erro ao criar tarefa" });
  }
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Backend rodando na porta ${PORT}`);
});
