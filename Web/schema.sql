-- =======================================================
-- ESQUEMA DE BASE DE DATOS PARA CLOUDFLARE D1 (SQLITE)
-- Multiverso Wiki - Usuarios y Contenidos
-- =======================================================

-- 1. Tabla de Usuarios
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    avatar_url TEXT,
    avatar_color TEXT DEFAULT 'bg-indigo-600',
    allowed_world_ids TEXT, -- Guardado como JSON string (null = todos)
    favorites TEXT DEFAULT '[]', -- Guardado como JSON string array
    created_at TEXT NOT NULL
);

-- 2. Tabla de Contenidos de la Wiki (Entidades)
CREATE TABLE IF NOT EXISTS wiki_items (
    id TEXT PRIMARY KEY,
    tipo TEXT NOT NULL,
    nombre TEXT NOT NULL,
    mundo_id TEXT NOT NULL,
    relaciones TEXT, -- JSON string
    detalles TEXT, -- JSON string
    etiquetas_discord TEXT, -- JSON string
    contenido_lore TEXT,
    imagenes TEXT, -- JSON string array
    url_discord TEXT,
    is_favorite INTEGER DEFAULT 0,
    created_at TEXT
);

-- =======================================================
-- USUARIOS INICIALES RESERVADOS
-- =======================================================
INSERT OR IGNORE INTO users (id, username, password, role, avatar_color, allowed_world_ids, favorites, created_at)
VALUES 
    ('user_admin', 'admin', 'admin', 'admin', 'bg-indigo-600', NULL, '["faccion_familia_mikaelson","faccion_clan_de_la_rosa"]', CURRENT_TIMESTAMP),
    ('user_invitado', 'Invitado', '', 'guest', 'bg-slate-600', '[]', '[]', CURRENT_TIMESTAMP);
