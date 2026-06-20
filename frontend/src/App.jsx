import { useEffect, useState } from "react";
import axios from "axios";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

function App() {
  const [tarefas, setTarefas] = useState([]);
  const [titulo, setTitulo] = useState("");

  async function carregarTarefas() {
    const resposta = await axios.get(`${API_URL}/tarefas`);
    setTarefas(resposta.data);
  }

  async function criarTarefa(e) {
    e.preventDefault();

    if (!titulo.trim()) return;

    await axios.post(`${API_URL}/tarefas`, {
      titulo,
    });

    setTitulo("");
    carregarTarefas();
  }

  useEffect(() => {
    carregarTarefas();
  }, []);

  return (
    <div className="container">
      <h1>Projeto Cloud com Dokploy</h1>

      <p>
        Aplicação web completa com React, Node.js, Express e PostgreSQL.
      </p>

      <form onSubmit={criarTarefa}>
        <input
          type="text"
          placeholder="Digite uma nova tarefa"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
        />

        <button type="submit">Adicionar</button>
      </form>

      <ul>
        {tarefas.map((tarefa) => (
          <li key={tarefa.id}>
            {tarefa.titulo}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
