interface Env {
  DB: any; // Cloudflare D1Database binding
}

export const onRequest = async (context: { request: Request; env: Env; params: { path?: string[] } }) => {
  const { request, env, params } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  const jsonResponse = (data: any, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });

  if (method === 'OPTIONS') {
    return jsonResponse({}, 200);
  }

  // If Cloudflare D1 binding is not set, return fallback warning
  if (!env.DB) {
    return jsonResponse(
      {
        success: false,
        error: 'Cloudflare D1 database binding (DB) is missing in wrangler.toml or Cloudflare dashboard.',
      },
      500
    );
  }

  try {
    // 1. GET /api/users
    if (path === '/api/users' && method === 'GET') {
      const { results } = await env.DB.prepare('SELECT * FROM users').all();
      const users = (results || []).map((u: any) => ({
        id: u.id,
        username: u.username,
        password: u.password,
        role: u.role,
        avatarUrl: u.avatar_url,
        avatarColor: u.avatar_color,
        allowedWorldIds: u.allowed_world_ids ? JSON.parse(u.allowed_world_ids) : null,
        favorites: u.favorites ? JSON.parse(u.favorites) : [],
        createdAt: u.created_at,
      }));
      return jsonResponse({ success: true, users });
    }

    // 2. POST /api/users/login
    if (path === '/api/users/login' && method === 'POST') {
      const body = await request.json();
      const { username, password } = body;
      if (!username) {
        return jsonResponse({ success: false, error: 'Nombre de usuario requerido' }, 400);
      }
      const cleanUsername = String(username).trim().toLowerCase();
      const userRaw: any = await env.DB.prepare('SELECT * FROM users WHERE LOWER(username) = ?').bind(cleanUsername).first();

      if (!userRaw) {
        return jsonResponse({ success: false, error: 'Usuario no encontrado' }, 404);
      }

      const user = {
        id: userRaw.id,
        username: userRaw.username,
        password: userRaw.password,
        role: userRaw.role,
        avatarUrl: userRaw.avatar_url,
        avatarColor: userRaw.avatar_color,
        allowedWorldIds: userRaw.allowed_world_ids ? JSON.parse(userRaw.allowed_world_ids) : null,
        favorites: userRaw.favorites ? JSON.parse(userRaw.favorites) : [],
        createdAt: userRaw.created_at,
      };

      if (user.role !== 'guest' && user.username.toLowerCase() !== 'invitado') {
        if (user.password !== password) {
          return jsonResponse({ success: false, error: 'Contraseña incorrecta' }, 401);
        }
      }

      return jsonResponse({ success: true, user });
    }

    // 3. POST /api/users/register
    if (path === '/api/users/register' && method === 'POST') {
      const body = await request.json();
      const { username, password } = body;
      if (!username || !password) {
        return jsonResponse({ success: false, error: 'Nombre de usuario y contraseña requeridos' }, 400);
      }

      const cleanUsername = String(username).trim();
      if (cleanUsername.toLowerCase() === 'invitado' || cleanUsername.toLowerCase() === 'admin') {
        return jsonResponse({ success: false, error: 'Ese nombre de usuario está reservado por el sistema' }, 400);
      }

      const existing = await env.DB.prepare('SELECT * FROM users WHERE LOWER(username) = ?').bind(cleanUsername.toLowerCase()).first();
      if (existing) {
        return jsonResponse({ success: false, error: 'El nombre de usuario ya está registrado' }, 400);
      }

      const colors = ['bg-indigo-600', 'bg-purple-600', 'bg-emerald-600', 'bg-amber-600', 'bg-rose-600', 'bg-cyan-600'];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];

      const guestUserRaw: any = await env.DB.prepare('SELECT * FROM users WHERE LOWER(username) = ? OR role = ?')
        .bind('invitado', 'guest')
        .first();
      const guestAllowedWorlds = guestUserRaw && guestUserRaw.allowed_world_ids ? JSON.parse(guestUserRaw.allowed_world_ids) : [];

      const id = `user_${Date.now()}`;
      const createdAt = new Date().toISOString();

      await env.DB.prepare(
        'INSERT INTO users (id, username, password, role, avatar_color, allowed_world_ids, favorites, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
        .bind(id, cleanUsername, password, 'user', randomColor, JSON.stringify(guestAllowedWorlds), JSON.stringify([]), createdAt)
        .run();

      const newUser = {
        id,
        username: cleanUsername,
        password,
        role: 'user',
        allowedWorldIds: guestAllowedWorlds,
        favorites: [],
        avatarColor: randomColor,
        createdAt,
      };

      return jsonResponse({ success: true, user: newUser });
    }

    // 4. PUT /api/users/:id
    if (path.startsWith('/api/users/') && method === 'PUT') {
      const userId = path.replace('/api/users/', '');
      const body = await request.json();

      const existingRaw: any = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();
      if (!existingRaw) {
        return jsonResponse({ success: false, error: 'Usuario no encontrado' }, 404);
      }

      const role = body.role !== undefined ? body.role : existingRaw.role;
      const allowedWorldIds = body.allowedWorldIds !== undefined ? (body.allowedWorldIds === null ? null : JSON.stringify(body.allowedWorldIds)) : existingRaw.allowed_world_ids;
      const favorites = body.favorites !== undefined ? JSON.stringify(body.favorites) : existingRaw.favorites;
      const password = body.password !== undefined ? body.password : existingRaw.password;

      await env.DB.prepare(
        'UPDATE users SET role = ?, allowed_world_ids = ?, favorites = ?, password = ? WHERE id = ?'
      )
        .bind(role, allowedWorldIds, favorites, password, userId)
        .run();

      const updatedUser = {
        id: existingRaw.id,
        username: existingRaw.username,
        password,
        role,
        avatarUrl: existingRaw.avatar_url,
        avatarColor: existingRaw.avatar_color,
        allowedWorldIds: allowedWorldIds ? JSON.parse(allowedWorldIds) : null,
        favorites: favorites ? JSON.parse(favorites) : [],
        createdAt: existingRaw.created_at,
      };

      return jsonResponse({ success: true, user: updatedUser });
    }

    // 5. DELETE /api/users/:id
    if (path.startsWith('/api/users/') && method === 'DELETE') {
      const userId = path.replace('/api/users/', '');
      const userToDelete: any = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();

      if (!userToDelete) {
        return jsonResponse({ success: false, error: 'Usuario no encontrado' }, 404);
      }

      if (userToDelete.username.toLowerCase() === 'admin' || userToDelete.username.toLowerCase() === 'invitado') {
        return jsonResponse({ success: false, error: 'No se puede eliminar las cuentas especiales reservadas (admin / invitado)' }, 400);
      }

      await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();
      return jsonResponse({ success: true, deletedId: userId });
    }

    // 6. GET /api/wiki-data
    if (path === '/api/wiki-data' && method === 'GET') {
      const { results } = await env.DB.prepare('SELECT * FROM wiki_items').all();
      const items = (results || []).map((w: any) => ({
        id: w.id,
        tipo: w.tipo,
        nombre: w.nombre,
        mundo_id: w.mundo_id,
        relaciones: w.relaciones ? JSON.parse(w.relaciones) : [],
        detalles: w.detalles ? JSON.parse(w.detalles) : {},
        etiquetas_discord: w.etiquetas_discord ? JSON.parse(w.etiquetas_discord) : [],
        contenido_lore: w.contenido_lore || '',
        imagenes: w.imagenes ? JSON.parse(w.imagenes) : [],
        url_discord: w.url_discord || '',
        isFavorite: Boolean(w.is_favorite),
        createdAt: w.created_at,
      }));
      return jsonResponse({ success: true, count: items.length, data: items });
    }

    // 7. POST /api/wiki-data
    if (path === '/api/wiki-data' && method === 'POST') {
      const body = await request.json();
      const { data } = body;
      if (!Array.isArray(data)) {
        return jsonResponse({ success: false, error: 'Data debe ser un arreglo de entidades' }, 400);
      }

      // Batch insert into D1
      const statements = data.map((item: any) =>
        env.DB.prepare(
          `INSERT OR REPLACE INTO wiki_items 
           (id, tipo, nombre, mundo_id, relaciones, detalles, etiquetas_discord, contenido_lore, imagenes, url_discord, is_favorite, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          item.id,
          item.tipo || '',
          item.nombre || '',
          item.mundo_id || '',
          item.relaciones ? JSON.stringify(item.relaciones) : null,
          item.detalles ? JSON.stringify(item.detalles) : null,
          item.etiquetas_discord ? JSON.stringify(item.etiquetas_discord) : null,
          item.contenido_lore || null,
          item.imagenes ? JSON.stringify(item.imagenes) : null,
          item.url_discord || null,
          item.isFavorite ? 1 : 0,
          item.createdAt || new Date().toISOString()
        )
      );

      if (statements.length > 0) {
        await env.DB.batch(statements);
      }

      return jsonResponse({ success: true, count: data.length });
    }

    // 8. POST /api/discord-log
    if (path === '/api/discord-log' && method === 'POST') {
      const body = await request.json();
      const webhookUrl = (body.webhookUrl || (env as any).DISCORD_WEBHOOK_URL || '').trim();

      if (!webhookUrl) {
        return jsonResponse(
          {
            success: false,
            error: 'No se ha configurado la URL del Webhook de Discord. Ingresa la URL en la configuración.',
          },
          400
        );
      }

      const { username, role, eventType } = body;
      const dateStr = new Date().toLocaleString('es-ES', {
        dateStyle: 'full',
        timeStyle: 'medium',
      });

      const isTest = eventType === 'test';
      const isLogin = eventType === 'login';

      const embedTitle = isTest
        ? '🤖 Prueba de Conexión con Discord Webhook'
        : isLogin
        ? '🔐 Inicio de Sesión de Usuario'
        : '📥 Nuevo Acceso a Multiverso Wiki';

      const embedColor = isTest ? 3447003 : isLogin ? 5763719 : 5814783;

      const discordPayload = {
        username: 'Multiverso Wiki Bot',
        avatar_url: 'https://cdn-icons-png.flaticon.com/512/3688/3688609.png',
        embeds: [
          {
            title: embedTitle,
            color: embedColor,
            fields: [
              {
                name: '👤 Usuario',
                value: `**${username || 'Invitado'}**`,
                inline: true,
              },
              {
                name: '🛡️ Rol',
                value: `\`${(role || 'user').toUpperCase()}\``,
                inline: true,
              },
              {
                name: '📅 Fecha y Hora',
                value: `\`${dateStr}\``,
                inline: false,
              },
            ],
            footer: {
              text: 'Multiverso Wiki • Registro de Accesos',
            },
            timestamp: new Date().toISOString(),
          },
        ],
      };

      const discordRes = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(discordPayload),
      });

      if (discordRes.ok || discordRes.status === 204) {
        return jsonResponse({ success: true });
      } else {
        const errText = await discordRes.text();
        return jsonResponse({ success: false, error: `Discord Webhook error: ${errText || discordRes.status}` }, 400);
      }
    }

    return jsonResponse({ success: false, error: 'Ruta no encontrada' }, 404);
  } catch (err: any) {
    return jsonResponse({ success: false, error: err.message }, 500);
  }
};
