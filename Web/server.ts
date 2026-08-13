import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));

  // API endpoint to read wiki_database.json dynamically (GitHub REST API primary + disk fallback)
  app.get("/api/wiki-data", async (req, res) => {
    try {
      const candidatePaths = [
        "Web/public/wiki_database.json",
        "web/wiki_database.json",
        "Web/wiki_database.json",
        "wiki_database.json",
      ];

      // 1. Try fetching directly from GitHub REST API (bypasses GitHub Raw 5-minute CDN cache)
      for (const ghPath of candidatePaths) {
        try {
          const ghApiRes = await fetch(
            `https://api.github.com/repos/Launcher69/Project-KAYN/contents/${ghPath}?t=` + Date.now(),
            { headers: { "Cache-Control": "no-cache, no-store", "User-Agent": "WikiApp" } }
          );
          if (ghApiRes.ok) {
            const ghJson = await ghApiRes.json();
            if (ghJson.content && ghJson.encoding === "base64") {
              const cleanBase64 = ghJson.content.replace(/\n/g, "");
              const buffer = Buffer.from(cleanBase64, "base64");
              const decodedText = buffer.toString("utf-8");
              const parsed = JSON.parse(decodedText);
              const dataArray = Array.isArray(parsed) ? parsed : parsed?.data;
              if (Array.isArray(dataArray) && dataArray.length > 0) {
                try {
                  const publicPath = path.join(process.cwd(), "public", "wiki_database.json");
                  fs.writeFileSync(publicPath, JSON.stringify(dataArray, null, 2), "utf-8");
                } catch {}
                return res.json({ success: true, count: dataArray.length, data: dataArray });
              }
            }
          }
        } catch (ghErr) {
          console.warn(`GitHub REST API fetch error for ${ghPath}:`, ghErr);
        }
      }

      // 2. Try raw fallback
      try {
        const ghRes = await fetch("https://raw.githubusercontent.com/Launcher69/Project-KAYN/main/Web/public/wiki_database.json?t=" + Date.now(), {
          headers: { "Cache-Control": "no-cache, no-store" },
        });
        if (ghRes.ok) {
          const ghJson = await ghRes.json();
          const dataArray = Array.isArray(ghJson) ? ghJson : ghJson?.data;
          if (Array.isArray(dataArray) && dataArray.length > 0) {
            try {
              const publicPath = path.join(process.cwd(), "public", "wiki_database.json");
              fs.writeFileSync(publicPath, JSON.stringify(dataArray, null, 2), "utf-8");
            } catch {}
            return res.json({ success: true, count: dataArray.length, data: dataArray });
          }
        }
      } catch (ghErr) {
        console.warn("GitHub Raw fetch error on server, fallback to disk:", ghErr);
      }

      // 2. Disk fallback
      const publicPath = path.join(process.cwd(), "public", "wiki_database.json");
      const rootPath = path.join(process.cwd(), "wiki_database.json");

      let filePath = publicPath;
      if (!fs.existsSync(filePath) && fs.existsSync(rootPath)) {
        filePath = rootPath;
      }

      if (fs.existsSync(filePath)) {
        const fileData = fs.readFileSync(filePath, "utf-8");
        const json = JSON.parse(fileData);
        return res.json({ success: true, count: json.length, data: json });
      }

      return res.status(404).json({ success: false, error: "Archivo wiki_database.json no encontrado" });
    } catch (err: any) {
      console.error("Error leyendo wiki_database.json:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // API endpoint to update wiki_database.json
  app.post("/api/wiki-data", (req, res) => {
    try {
      const { data } = req.body;
      if (!Array.isArray(data)) {
        return res.status(400).json({ success: false, error: "Data debe ser un arreglo de entidades" });
      }

      const jsonStr = JSON.stringify(data, null, 2);
      const publicPath = path.join(process.cwd(), "public", "wiki_database.json");
      const rootPath = path.join(process.cwd(), "wiki_database.json");

      if (!fs.existsSync(path.dirname(publicPath))) {
        fs.mkdirSync(path.dirname(publicPath), { recursive: true });
      }

      fs.writeFileSync(publicPath, jsonStr, "utf-8");
      fs.writeFileSync(rootPath, jsonStr, "utf-8");

      return res.json({ success: true, count: data.length });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // API endpoint to proxy edits to Discord Bot on Render
  app.post("/api/edit-discord-item", async (req, res) => {
    try {
      console.log("Enviando petición a Bot de Discord en Render:", req.body?.id);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45000); // 45s timeout for Render cold start

      const renderRes = await fetch("https://wiki-bot-discord.onrender.com/api/edit-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const responseText = await renderRes.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseErr) {
        if (renderRes.status === 501 || responseText.includes("Unsupported method ('POST')")) {
          data = {
            success: false,
            error: "El servidor de Render está usando SimpleHTTPRequestHandler (HTTP 501: Unsupported method POST). Debes actualizar 'main.py' en el Bot para que acepte peticiones POST en /api/edit-item."
          };
        } else if (responseText.includes("<!DOCTYPE") || responseText.includes("<html")) {
          data = { success: false, error: `Servidor devolvió error HTML ${renderRes.status}` };
        } else {
          data = { success: false, error: responseText || `HTTP ${renderRes.status}` };
        }
      }

      return res.status(renderRes.status).json(data);
    } catch (err: any) {
      console.error("Error al proxy de edición a Discord Bot:", err);
      const isTimeout = err.name === 'AbortError';
      return res.status(500).json({
        success: false,
        error: isTimeout
          ? "El servidor de Render tardó demasiado en responder (posiblemente iniciando el bot de Discord)."
          : err.message || "Error al conectar con el servidor del Bot."
      });
    }
  });

  // User persistence helpers
  const getUsersFilePath = () => {
    const publicPath = path.join(process.cwd(), "public", "users.json");
    const rootPath = path.join(process.cwd(), "users.json");
    if (!fs.existsSync(publicPath) && fs.existsSync(rootPath)) {
      return rootPath;
    }
    return publicPath;
  };

  const saveUsersFile = (users: any[]) => {
    try {
      const jsonStr = JSON.stringify(users, null, 2);
      const publicPath = path.join(process.cwd(), "public", "users.json");
      const rootPath = path.join(process.cwd(), "users.json");
      if (!fs.existsSync(path.dirname(publicPath))) {
        fs.mkdirSync(path.dirname(publicPath), { recursive: true });
      }
      fs.writeFileSync(publicPath, jsonStr, "utf-8");
      fs.writeFileSync(rootPath, jsonStr, "utf-8");
    } catch (err) {
      console.error("Error saving users.json:", err);
    }
  };

  const loadUsersFile = (): any[] => {
    try {
      const filePath = getUsersFilePath();
      if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, "utf-8");
        const users = JSON.parse(fileContent);
        if (Array.isArray(users)) {
          let updated = false;
          const adminExists = users.some(u => u.username.toLowerCase() === "admin");
          if (!adminExists) {
            users.unshift({
              id: "user_admin",
              username: "admin",
              password: "admin",
              role: "admin",
              allowedWorldIds: null,
              favorites: [],
              avatarColor: "bg-indigo-600",
              createdAt: new Date().toISOString()
            });
            updated = true;
          }

          const guestExists = users.some(u => u.username.toLowerCase() === "invitado");
          if (!guestExists) {
            users.push({
              id: "user_invitado",
              username: "Invitado",
              password: "",
              role: "guest",
              allowedWorldIds: [], // Defaults to empty or configurable by admin
              favorites: [],
              avatarColor: "bg-slate-600",
              createdAt: new Date().toISOString()
            });
            updated = true;
          }

          if (updated) {
            saveUsersFile(users);
          }
          return users;
        }
      }
    } catch (err) {
      console.error("Error loading users.json:", err);
    }

    const defaultUsers = [
      {
        id: "user_admin",
        username: "admin",
        password: "admin",
        role: "admin",
        allowedWorldIds: null,
        favorites: [],
        avatarColor: "bg-indigo-600",
        createdAt: new Date().toISOString()
      },
      {
        id: "user_invitado",
        username: "Invitado",
        password: "",
        role: "guest",
        allowedWorldIds: [],
        favorites: [],
        avatarColor: "bg-slate-600",
        createdAt: new Date().toISOString()
      }
    ];
    saveUsersFile(defaultUsers);
    return defaultUsers;
  };

  // API Users Endpoints
  app.get("/api/users", (req, res) => {
    const users = loadUsersFile();
    return res.json({ success: true, users });
  });

  app.post("/api/users/login", (req, res) => {
    const { username, password } = req.body;
    if (!username) {
      return res.status(400).json({ success: false, error: "Nombre de usuario requerido" });
    }
    const users = loadUsersFile();
    const cleanUsername = String(username).trim().toLowerCase();
    const user = users.find(u => u.username.toLowerCase() === cleanUsername);

    if (!user) {
      return res.status(404).json({ success: false, error: "Usuario no encontrado" });
    }
    // "Invitado" profile doesn't require password
    if (user.role !== 'guest' && user.username.toLowerCase() !== 'invitado') {
      if (user.password !== password) {
        return res.status(401).json({ success: false, error: "Contraseña incorrecta" });
      }
    }
    return res.json({ success: true, user });
  });

  app.post("/api/users/register", (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: "Nombre de usuario y contraseña requeridos" });
    }
    const cleanUsername = String(username).trim();
    if (cleanUsername.toLowerCase() === 'invitado' || cleanUsername.toLowerCase() === 'admin') {
      return res.status(400).json({ success: false, error: "Ese nombre de usuario está reservado por el sistema" });
    }
    const users = loadUsersFile();
    const existing = users.find(u => u.username.toLowerCase() === cleanUsername.toLowerCase());
    if (existing) {
      return res.status(400).json({ success: false, error: "El nombre de usuario ya está registrado" });
    }

    const colors = ['bg-indigo-600', 'bg-purple-600', 'bg-emerald-600', 'bg-amber-600', 'bg-rose-600', 'bg-cyan-600'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const guestUser = users.find(u => u.username.toLowerCase() === 'invitado' || u.role === 'guest');
    const guestAllowedWorlds = guestUser?.allowedWorldIds ? [...guestUser.allowedWorldIds] : [];

    const newUser = {
      id: `user_${Date.now()}`,
      username: cleanUsername,
      password,
      role: "user",
      allowedWorldIds: guestAllowedWorlds, // Default permissions copied from guest at creation
      favorites: [],
      avatarColor: randomColor,
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    saveUsersFile(users);
    return res.json({ success: true, user: newUser });
  });

  app.put("/api/users/:id", (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    const users = loadUsersFile();
    const index = users.findIndex(u => u.id === id);

    if (index === -1) {
      return res.status(404).json({ success: false, error: "Usuario no encontrado" });
    }

    const updatedUser = { ...users[index], ...updates };
    users[index] = updatedUser;
    saveUsersFile(users);
    return res.json({ success: true, user: updatedUser });
  });

  app.delete("/api/users/:id", (req, res) => {
    const { id } = req.params;
    let users = loadUsersFile();
    const userToDelete = users.find(u => u.id === id);

    if (!userToDelete) {
      return res.status(404).json({ success: false, error: "Usuario no encontrado" });
    }
    const lowerName = userToDelete.username.toLowerCase();
    if (lowerName === "admin" || lowerName === "invitado") {
      return res.status(400).json({ success: false, error: "No se pueden eliminar los usuarios especiales del sistema (admin e Invitado)" });
    }

    users = users.filter(u => u.id !== id);
    saveUsersFile(users);
    return res.json({ success: true });
  });

  // Export current JSON data as a SQL script for Cloudflare D1
  app.get("/api/export-d1", (req, res) => {
    try {
      const users = loadUsersFile();
      
      let wikiItems: any[] = [];
      const publicPath = path.join(process.cwd(), "public", "wiki_database.json");
      const rootPath = path.join(process.cwd(), "wiki_database.json");
      const wikiFile = fs.existsSync(publicPath) ? publicPath : (fs.existsSync(rootPath) ? rootPath : null);
      if (wikiFile) {
        wikiItems = JSON.parse(fs.readFileSync(wikiFile, "utf-8"));
      }

      let sql = `-- ESQUEMA E INSERCIÓN AUTOMÁTICA PARA CLOUDFLARE D1
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    avatar_url TEXT,
    avatar_color TEXT DEFAULT 'bg-indigo-600',
    allowed_world_ids TEXT,
    favorites TEXT DEFAULT '[]',
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS wiki_items (
    id TEXT PRIMARY KEY,
    tipo TEXT NOT NULL,
    nombre TEXT NOT NULL,
    mundo_id TEXT NOT NULL,
    relaciones TEXT,
    detalles TEXT,
    etiquetas_discord TEXT,
    contenido_lore TEXT,
    imagenes TEXT,
    url_discord TEXT,
    is_favorite INTEGER DEFAULT 0,
    created_at TEXT
);

-- INSERCIÓN DE USUARIOS (${users.length}):
`;

      users.forEach((u: any) => {
        const id = JSON.stringify(u.id || '');
        const username = JSON.stringify(u.username || '');
        const password = JSON.stringify(u.password || '');
        const role = JSON.stringify(u.role || 'user');
        const avatarUrl = u.avatarUrl ? JSON.stringify(u.avatarUrl) : 'NULL';
        const avatarColor = JSON.stringify(u.avatarColor || 'bg-indigo-600');
        const allowedWorldIds = u.allowedWorldIds !== undefined && u.allowedWorldIds !== null ? JSON.stringify(JSON.stringify(u.allowedWorldIds)) : 'NULL';
        const favorites = JSON.stringify(JSON.stringify(u.favorites || []));
        const createdAt = JSON.stringify(u.createdAt || new Date().toISOString());

        sql += `INSERT OR REPLACE INTO users (id, username, password, role, avatar_url, avatar_color, allowed_world_ids, favorites, created_at) VALUES (${id}, ${username}, ${password}, ${role}, ${avatarUrl}, ${avatarColor}, ${allowedWorldIds}, ${favorites}, ${createdAt});\n`;
      });

      sql += `\n-- INSERCIÓN DE ARTÍCULOS WIKI (${wikiItems.length}):\n`;

      wikiItems.forEach((w: any) => {
        const id = JSON.stringify(w.id || '');
        const tipo = JSON.stringify(w.tipo || '');
        const nombre = JSON.stringify(w.nombre || '');
        const mundoId = JSON.stringify(w.mundo_id || '');
        const relaciones = w.relaciones ? JSON.stringify(JSON.stringify(w.relaciones)) : 'NULL';
        const detalles = w.detalles ? JSON.stringify(JSON.stringify(w.detalles)) : 'NULL';
        const etiquetas = w.etiquetas_discord ? JSON.stringify(JSON.stringify(w.etiquetas_discord)) : 'NULL';
        const lore = w.contenido_lore ? JSON.stringify(w.contenido_lore) : 'NULL';
        const imagenes = w.imagenes ? JSON.stringify(JSON.stringify(w.imagenes)) : 'NULL';
        const urlDiscord = w.url_discord ? JSON.stringify(w.url_discord) : 'NULL';
        const isFav = w.isFavorite ? 1 : 0;
        const createdAt = JSON.stringify(w.createdAt || new Date().toISOString());

        sql += `INSERT OR REPLACE INTO wiki_items (id, tipo, nombre, mundo_id, relaciones, detalles, etiquetas_discord, contenido_lore, imagenes, url_discord, is_favorite, created_at) VALUES (${id}, ${tipo}, ${nombre}, ${mundoId}, ${relaciones}, ${detalles}, ${etiquetas}, ${lore}, ${imagenes}, ${urlDiscord}, ${isFav}, ${createdAt});\n`;
      });

      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      return res.send(sql);
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Relay logs to Discord Webhook
  app.post("/api/discord-log", async (req, res) => {
    try {
      const webhookUrl = (req.body?.webhookUrl || process.env.DISCORD_WEBHOOK_URL || "").trim();

      if (!webhookUrl) {
        return res.status(400).json({
          success: false,
          error: "No se ha configurado la URL del Webhook de Discord. Ingresa la URL en la configuración.",
        });
      }

      const { username, role, eventType } = req.body;
      const dateStr = new Date().toLocaleString("es-ES", {
        dateStyle: "full",
        timeStyle: "medium",
      });

      const isTest = eventType === "test";
      const isLogin = eventType === "login";

      const embedTitle = isTest
        ? "🤖 Prueba de Conexión con Discord Webhook"
        : isLogin
        ? "🔐 Inicio de Sesión de Usuario"
        : "📥 Nuevo Acceso a Multiverso Wiki";

      const embedColor = isTest ? 3447003 : isLogin ? 5763719 : 5814783;

      const discordPayload = {
        username: "Multiverso Wiki Bot",
        avatar_url: "https://cdn-icons-png.flaticon.com/512/3688/3688609.png",
        embeds: [
          {
            title: embedTitle,
            color: embedColor,
            fields: [
              {
                name: "👤 Usuario",
                value: `**${username || "Invitado"}**`,
                inline: true,
              },
              {
                name: "🛡️ Rol",
                value: `\`${(role || "user").toUpperCase()}\``,
                inline: true,
              },
              {
                name: "📅 Fecha y Hora",
                value: `\`${dateStr}\``,
                inline: false,
              },
            ],
            footer: {
              text: "Multiverso Wiki • Registro de Accesos",
            },
            timestamp: new Date().toISOString(),
          },
        ],
      };

      const discordRes = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(discordPayload),
      });

      if (discordRes.ok || discordRes.status === 204) {
        return res.json({ success: true });
      } else {
        const errText = await discordRes.text();
        return res.status(400).json({ success: false, error: `Discord Webhook error: ${errText || discordRes.status}` });
      }
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
