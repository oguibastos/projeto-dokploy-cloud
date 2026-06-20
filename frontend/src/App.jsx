import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

const statusLabels = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluida: "Concluída",
};

const priorityLabels = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
};

const emptyTask = {
  title: "",
  description: "",
  status: "pendente",
  priority: "media",
  due_date: "",
};

function App() {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem("user");
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const [authMode, setAuthMode] = useState("login");
  const [authData, setAuthData] = useState({
    name: "",
    email: "admin@projeto.com",
    password: "admin123",
  });

  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState(null);
  const [form, setForm] = useState(emptyTask);
  const [editingTask, setEditingTask] = useState(null);

  const [filters, setFilters] = useState({
    search: "",
    status: "todas",
    priority: "todas",
  });

  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const api = useMemo(() => {
    return axios.create({
      baseURL: API_URL,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  }, [token]);

  function showSuccess(message) {
    setSuccess(message);
    setTimeout(() => setSuccess(""), 3000);
  }

  function showError(message) {
    setError(message);
    setTimeout(() => setError(""), 4000);
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setAuthLoading(true);
    setError("");

    try {
      const endpoint = authMode === "login" ? "/auth/login" : "/auth/register";

      const payload =
        authMode === "login"
          ? {
              email: authData.email,
              password: authData.password,
            }
          : authData;

      const response = await axios.post(`${API_URL}${endpoint}`, payload);

      localStorage.setItem("token", response.data.token);
      localStorage.setItem("user", JSON.stringify(response.data.user));

      setToken(response.data.token);
      setUser(response.data.user);
      showSuccess("Autenticação realizada com sucesso!");
    } catch (err) {
      showError(err.response?.data?.error || "Erro ao autenticar usuário");
    } finally {
      setAuthLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken("");
    setUser(null);
    setTasks([]);
    setStats(null);
    setForm(emptyTask);
    setEditingTask(null);
  }

  async function loadTasks() {
    if (!token) return;

    setLoading(true);

    try {
      const params = {};

      if (filters.status !== "todas") params.status = filters.status;
      if (filters.priority !== "todas") params.priority = filters.priority;
      if (filters.search.trim()) params.search = filters.search.trim();

      const response = await api.get("/tasks", { params });
      setTasks(response.data);
    } catch (err) {
      if (err.response?.status === 401) {
        logout();
        showError("Sessão expirada. Faça login novamente.");
      } else {
        showError("Erro ao carregar tarefas");
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadStats() {
    if (!token) return;

    try {
      const response = await api.get("/stats");
      setStats(response.data);
    } catch {
      setStats(null);
    }
  }

  async function handleTaskSubmit(event) {
    event.preventDefault();

    if (!form.title.trim()) {
      showError("Informe o título da tarefa");
      return;
    }

    try {
      if (editingTask) {
        await api.put(`/tasks/${editingTask.id}`, form);
        showSuccess("Tarefa atualizada com sucesso!");
      } else {
        await api.post("/tasks", form);
        showSuccess("Tarefa criada com sucesso!");
      }

      setForm(emptyTask);
      setEditingTask(null);
      await loadTasks();
      await loadStats();
    } catch (err) {
      showError(err.response?.data?.error || "Erro ao salvar tarefa");
    }
  }

  function startEdit(task) {
    setEditingTask(task);
    setForm({
      title: task.title || "",
      description: task.description || "",
      status: task.status || "pendente",
      priority: task.priority || "media",
      due_date: task.due_date ? task.due_date.substring(0, 10) : "",
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function cancelEdit() {
    setEditingTask(null);
    setForm(emptyTask);
  }

  async function updateStatus(task, nextStatus) {
    try {
      await api.patch(`/tasks/${task.id}/status`, {
        status: nextStatus,
      });

      showSuccess("Status atualizado!");
      await loadTasks();
      await loadStats();
    } catch {
      showError("Erro ao atualizar status");
    }
  }

  async function deleteTask(task) {
    const confirmDelete = window.confirm(
      `Deseja realmente excluir a tarefa "${task.title}"?`
    );

    if (!confirmDelete) return;

    try {
      await api.delete(`/tasks/${task.id}`);
      showSuccess("Tarefa removida com sucesso!");
      await loadTasks();
      await loadStats();
    } catch {
      showError("Erro ao remover tarefa");
    }
  }

  function formatDate(date) {
    if (!date) return "Sem prazo";
    return new Date(date).toLocaleDateString("pt-BR", {
      timeZone: "UTC",
    });
  }

  useEffect(() => {
    if (token) {
      loadTasks();
      loadStats();
    }
  }, [token]);

  useEffect(() => {
    const delay = setTimeout(() => {
      if (token) {
        loadTasks();
      }
    }, 350);

    return () => clearTimeout(delay);
  }, [filters]);

  if (!token) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <div className="brand-area">
            <div className="logo">✓</div>
            <h1>Sistema de Tarefas</h1>
            <p>
              Aplicação web completa com autenticação, CRUD, filtros, dashboard
              e persistência em PostgreSQL.
            </p>
          </div>

          <div className="auth-tabs">
            <button
              className={authMode === "login" ? "active" : ""}
              onClick={() => setAuthMode("login")}
            >
              Entrar
            </button>

            <button
              className={authMode === "register" ? "active" : ""}
              onClick={() => setAuthMode("register")}
            >
              Criar conta
            </button>
          </div>

          <form onSubmit={handleAuthSubmit} className="auth-form">
            {authMode === "register" && (
              <label>
                Nome
                <input
                  type="text"
                  placeholder="Seu nome"
                  value={authData.name}
                  onChange={(e) =>
                    setAuthData({ ...authData, name: e.target.value })
                  }
                />
              </label>
            )}

            <label>
              E-mail
              <input
                type="email"
                placeholder="seuemail@exemplo.com"
                value={authData.email}
                onChange={(e) =>
                  setAuthData({ ...authData, email: e.target.value })
                }
              />
            </label>

            <label>
              Senha
              <input
                type="password"
                placeholder="Digite sua senha"
                value={authData.password}
                onChange={(e) =>
                  setAuthData({ ...authData, password: e.target.value })
                }
              />
            </label>

            {error && <div className="alert error">{error}</div>}
            {success && <div className="alert success">{success}</div>}

            <button className="primary-button" disabled={authLoading}>
              {authLoading
                ? "Processando..."
                : authMode === "login"
                ? "Entrar no sistema"
                : "Criar minha conta"}
            </button>
          </form>

          <div className="demo-box">
            <strong>Usuário de demonstração</strong>
            <span>admin@projeto.com</span>
            <span>admin123</span>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="app-page">
      <header className="topbar">
        <div>
          <span className="eyebrow">Projeto Cloud com Dokploy</span>
          <h1>Sistema de Tarefas</h1>
          <p>
            Bem-vindo, <strong>{user?.name}</strong>. Gerencie suas tarefas de
            forma organizada.
          </p>
        </div>

        <button className="logout-button" onClick={logout}>
          Sair
        </button>
      </header>

      {error && <div className="floating-alert error">{error}</div>}
      {success && <div className="floating-alert success">{success}</div>}

      <section className="stats-grid">
        <article className="stat-card">
          <span>Total</span>
          <strong>{stats?.total ?? 0}</strong>
        </article>

        <article className="stat-card">
          <span>Pendentes</span>
          <strong>{stats?.pendentes ?? 0}</strong>
        </article>

        <article className="stat-card">
          <span>Em andamento</span>
          <strong>{stats?.em_andamento ?? 0}</strong>
        </article>

        <article className="stat-card">
          <span>Concluídas</span>
          <strong>{stats?.concluidas ?? 0}</strong>
        </article>

        <article className="stat-card highlight">
          <span>Alta prioridade</span>
          <strong>{stats?.alta_prioridade ?? 0}</strong>
        </article>
      </section>

      <section className="content-grid">
        <aside className="task-form-card">
          <div className="section-title">
            <h2>{editingTask ? "Editar tarefa" : "Nova tarefa"}</h2>
            <p>
              {editingTask
                ? "Atualize os dados da tarefa selecionada."
                : "Cadastre uma nova tarefa no sistema."}
            </p>
          </div>

          <form onSubmit={handleTaskSubmit} className="task-form">
            <label>
              Título
              <input
                type="text"
                placeholder="Ex: Finalizar documentação"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </label>

            <label>
              Descrição
              <textarea
                placeholder="Detalhe o que precisa ser feito"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </label>

            <div className="form-row">
              <label>
                Status
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm({ ...form, status: e.target.value })
                  }
                >
                  <option value="pendente">Pendente</option>
                  <option value="em_andamento">Em andamento</option>
                  <option value="concluida">Concluída</option>
                </select>
              </label>

              <label>
                Prioridade
                <select
                  value={form.priority}
                  onChange={(e) =>
                    setForm({ ...form, priority: e.target.value })
                  }
                >
                  <option value="baixa">Baixa</option>
                  <option value="media">Média</option>
                  <option value="alta">Alta</option>
                </select>
              </label>
            </div>

            <label>
              Prazo
              <input
                type="date"
                value={form.due_date}
                onChange={(e) =>
                  setForm({ ...form, due_date: e.target.value })
                }
              />
            </label>

            <div className="form-actions">
              <button className="primary-button" type="submit">
                {editingTask ? "Salvar alterações" : "Criar tarefa"}
              </button>

              {editingTask && (
                <button
                  className="secondary-button"
                  type="button"
                  onClick={cancelEdit}
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </aside>

        <section className="tasks-panel">
          <div className="section-title">
            <h2>Minhas tarefas</h2>
            <p>Filtre, acompanhe, edite e remova suas atividades.</p>
          </div>

          <div className="filters">
            <input
              type="text"
              placeholder="Buscar por título ou descrição"
              value={filters.search}
              onChange={(e) =>
                setFilters({ ...filters, search: e.target.value })
              }
            />

            <select
              value={filters.status}
              onChange={(e) =>
                setFilters({ ...filters, status: e.target.value })
              }
            >
              <option value="todas">Todos os status</option>
              <option value="pendente">Pendente</option>
              <option value="em_andamento">Em andamento</option>
              <option value="concluida">Concluída</option>
            </select>

            <select
              value={filters.priority}
              onChange={(e) =>
                setFilters({ ...filters, priority: e.target.value })
              }
            >
              <option value="todas">Todas as prioridades</option>
              <option value="baixa">Baixa</option>
              <option value="media">Média</option>
              <option value="alta">Alta</option>
            </select>
          </div>

          {loading ? (
            <div className="empty-state">Carregando tarefas...</div>
          ) : tasks.length === 0 ? (
            <div className="empty-state">
              Nenhuma tarefa encontrada para os filtros selecionados.
            </div>
          ) : (
            <div className="task-list">
              {tasks.map((task) => (
                <article key={task.id} className={`task-card ${task.status}`}>
                  <div className="task-header">
                    <div>
                      <h3>{task.title}</h3>
                      <p>{task.description || "Sem descrição informada."}</p>
                    </div>

                    <span className={`priority ${task.priority}`}>
                      {priorityLabels[task.priority] || task.priority}
                    </span>
                  </div>

                  <div className="task-meta">
                    <span>Status: {statusLabels[task.status]}</span>
                    <span>Prazo: {formatDate(task.due_date)}</span>
                  </div>

                  <div className="quick-status">
                    <button
                      onClick={() => updateStatus(task, "pendente")}
                      className={task.status === "pendente" ? "active" : ""}
                    >
                      Pendente
                    </button>

                    <button
                      onClick={() => updateStatus(task, "em_andamento")}
                      className={
                        task.status === "em_andamento" ? "active" : ""
                      }
                    >
                      Em andamento
                    </button>

                    <button
                      onClick={() => updateStatus(task, "concluida")}
                      className={task.status === "concluida" ? "active" : ""}
                    >
                      Concluir
                    </button>
                  </div>

                  <div className="task-actions">
                    <button onClick={() => startEdit(task)}>Editar</button>
                    <button className="danger" onClick={() => deleteTask(task)}>
                      Excluir
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

export default App;
