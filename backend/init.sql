CREATE TABLE IF NOT EXISTS tarefas (
  id SERIAL PRIMARY KEY,
  titulo VARCHAR(255) NOT NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO tarefas (titulo)
VALUES 
('Provisionar servidor Linux'),
('Instalar Dokploy'),
('Publicar aplicação web')
ON CONFLICT DO NOTHING;
