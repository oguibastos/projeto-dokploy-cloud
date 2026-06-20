const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || "projeto-cloud-dokploy-secret";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function iniciarBanco() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      email VARCHAR(160) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(180) NOT NULL,
      description TEXT,
      status VARCHAR(30) DEFAULT 'pendente',
      priority VARCHAR(20) DEFAULT 'media',
      due_date DATE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
  `);

  const userResult = await pool.query("SELECT id FROM users WHERE email = $1", [
    "admin@projeto.com",
  ]);

  if (userResult.rows.length === 0) {
    const passwordHash = await bcrypt.hash("admin123", 10);

    const newUser = await pool.query(
      `
      INSERT INTO users (name, email, password_hash)
      VALUES ($1, $2, $3)
      RETURNING id;
      `,
      ["Administrador", "admin@projeto.com", passwordHash]
    );

    const userId = newUser.rows[0].id;

    await pool.query(
      `
      INSERT INTO tasks (user_id, title, description, status, priority, due_date)
      VALUES
      ($1, 'Provisionar servidor Linux', 'Servidor Ubuntu criado na Oracle Cloud Infrastructure.', 'concluida', 'alta', CURRENT_DATE),
      ($1, 'Instalar Dokploy', 'Dokploy instalado com Docker e Docker Compose.', 'concluida', 'alta', CURRENT_DATE),
      ($1, 'Publicar aplicação web', 'Aplicação publicada via Dokploy com integração GitHub.', 'em_andamento', 'alta', CURRENT_DATE + INTERVAL '2 days'),
      ($1, 'Documentar o projeto', 'Criar página descritiva com tecnologias, links e evidências.', 'pendente', 'media', CURRENT_DATE + INTERVAL '5 days');
      `,
      [userId]
    );
  }
}

function gerarToken(user) {
  return jwt.sign(
    {
      id: user.id,
      name: user.name,
      email: user.email,
    },
    JWT_SECRET,
    {
      expiresIn: "8h",
    }
  );
}

function autenticarToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      error: "Token não informado",
    });
  }

  const [, token] = authHeader.split(" ");

  if (!token) {
    return res.status(401).json({
      error: "Token inválido",
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      error: "Token expirado ou inválido",
    });
  }
}

app.get("/", (req, res) => {
  res.json({
    message: "Backend do Sistema de Tarefas com autenticação está funcionando!",
    version: "2.0.0",
    endpoints: {
      auth: ["/auth/register", "/auth/login", "/auth/me"],
      tasks: ["/tasks"],
    },
  });
});

app.post("/auth/register", async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({
      error: "Nome, e-mail e senha são obrigatórios",
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      error: "A senha deve ter no mínimo 6 caracteres",
    });
  }

  try {
    const existingUser = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        error: "Este e-mail já está cadastrado",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `
      INSERT INTO users (name, email, password_hash)
      VALUES ($1, $2, $3)
      RETURNING id, name, email, created_at;
      `,
      [name.trim(), email.toLowerCase().trim(), passwordHash]
    );

    const user = result.rows[0];
    const token = gerarToken(user);

    return res.status(201).json({
      user,
      token,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Erro ao cadastrar usuário",
    });
  }
});

app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: "E-mail e senha são obrigatórios",
    });
  }

  try {
    const result = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email.toLowerCase().trim()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: "E-mail ou senha inválidos",
      });
    }

    const user = result.rows[0];

    const senhaCorreta = await bcrypt.compare(password, user.password_hash);

    if (!senhaCorreta) {
      return res.status(401).json({
        error: "E-mail ou senha inválidos",
      });
    }

    const payload = {
      id: user.id,
      name: user.name,
      email: user.email,
    };

    const token = gerarToken(payload);

    return res.json({
      user: payload,
      token,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Erro ao realizar login",
    });
  }
});

app.get("/auth/me", autenticarToken, async (req, res) => {
  return res.json({
    user: req.user,
  });
});

app.get("/tasks", autenticarToken, async (req, res) => {
  try {
    const { status, priority, search } = req.query;

    const conditions = ["user_id = $1"];
    const values = [req.user.id];

    if (status && status !== "todas") {
      values.push(status);
      conditions.push(`status = $${values.length}`);
    }

    if (priority && priority !== "todas") {
      values.push(priority);
      conditions.push(`priority = $${values.length}`);
    }

    if (search) {
      values.push(`%${search}%`);
      conditions.push(
        `(title ILIKE $${values.length} OR description ILIKE $${values.length})`
      );
    }

    const query = `
      SELECT *
      FROM tasks
      WHERE ${conditions.join(" AND ")}
      ORDER BY
        CASE
          WHEN status = 'pendente' THEN 1
          WHEN status = 'em_andamento' THEN 2
          WHEN status = 'concluida' THEN 3
          ELSE 4
        END,
        created_at DESC;
    `;

    const result = await pool.query(query, values);

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Erro ao buscar tarefas",
    });
  }
});

app.get("/tasks/:id", autenticarToken, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT *
      FROM tasks
      WHERE id = $1 AND user_id = $2;
      `,
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Tarefa não encontrada",
      });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Erro ao buscar tarefa",
    });
  }
});

app.post("/tasks", autenticarToken, async (req, res) => {
  const { title, description, status, priority, due_date } = req.body;

  if (!title) {
    return res.status(400).json({
      error: "Título é obrigatório",
    });
  }

  try {
    const result = await pool.query(
      `
      INSERT INTO tasks (user_id, title, description, status, priority, due_date)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
      `,
      [
        req.user.id,
        title.trim(),
        description || "",
        status || "pendente",
        priority || "media",
        due_date || null,
      ]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Erro ao criar tarefa",
    });
  }
});

app.put("/tasks/:id", autenticarToken, async (req, res) => {
  const { title, description, status, priority, due_date } = req.body;

  if (!title) {
    return res.status(400).json({
      error: "Título é obrigatório",
    });
  }

  try {
    const result = await pool.query(
      `
      UPDATE tasks
      SET
        title = $1,
        description = $2,
        status = $3,
        priority = $4,
        due_date = $5,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $6 AND user_id = $7
      RETURNING *;
      `,
      [
        title.trim(),
        description || "",
        status || "pendente",
        priority || "media",
        due_date || null,
        req.params.id,
        req.user.id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Tarefa não encontrada",
      });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Erro ao atualizar tarefa",
    });
  }
});

app.patch("/tasks/:id/status", autenticarToken, async (req, res) => {
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({
      error: "Status é obrigatório",
    });
  }

  try {
    const result = await pool.query(
      `
      UPDATE tasks
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND user_id = $3
      RETURNING *;
      `,
      [status, req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Tarefa não encontrada",
      });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Erro ao alterar status da tarefa",
    });
  }
});

app.delete("/tasks/:id", autenticarToken, async (req, res) => {
  try {
    const result = await pool.query(
      `
      DELETE FROM tasks
      WHERE id = $1 AND user_id = $2
      RETURNING *;
      `,
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Tarefa não encontrada",
      });
    }

    return res.json({
      message: "Tarefa removida com sucesso",
      task: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Erro ao remover tarefa",
    });
  }
});

app.get("/stats", autenticarToken, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'pendente')::int AS pendentes,
        COUNT(*) FILTER (WHERE status = 'em_andamento')::int AS em_andamento,
        COUNT(*) FILTER (WHERE status = 'concluida')::int AS concluidas,
        COUNT(*) FILTER (WHERE priority = 'alta')::int AS alta_prioridade
      FROM tasks
      WHERE user_id = $1;
      `,
      [req.user.id]
    );

    return res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Erro ao buscar estatísticas",
    });
  }
});

async function iniciarServidor() {
  try {
    await iniciarBanco();

    app.listen(PORT, () => {
      console.log(`Backend rodando na porta ${PORT}`);
      console.log("Sistema de Tarefas com autenticação iniciado");
    });
  } catch (error) {
    console.error("Erro ao iniciar aplicação:", error);
    process.exit(1);
  }
}

iniciarServidor();
