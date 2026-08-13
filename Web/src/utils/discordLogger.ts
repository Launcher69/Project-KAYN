// Helper utility for sending user login and page access logs to Discord via Webhook

const DISCORD_WEBHOOK_STORAGE_KEY = 'multiverse_discord_webhook_url';

export const getDiscordWebhookUrl = (): string => {
  try {
    return localStorage.getItem(DISCORD_WEBHOOK_STORAGE_KEY) || '';
  } catch {
    return '';
  }
};

export const setDiscordWebhookUrl = (url: string): void => {
  try {
    if (url) {
      localStorage.setItem(DISCORD_WEBHOOK_STORAGE_KEY, url.trim());
    } else {
      localStorage.removeItem(DISCORD_WEBHOOK_STORAGE_KEY);
    }
  } catch {
    // Quota or access error
  }
};

interface LogOptions {
  username: string;
  role: string;
  avatarUrl?: string;
  eventType?: 'login' | 'entry' | 'test';
  customWebhookUrl?: string;
}

export const sendDiscordLog = async (options: LogOptions): Promise<{ success: boolean; error?: string }> => {
  const targetWebhookUrl = options.customWebhookUrl || getDiscordWebhookUrl();

  const payload = {
    webhookUrl: targetWebhookUrl,
    username: options.username,
    role: options.role,
    avatarUrl: options.avatarUrl,
    eventType: options.eventType || 'entry',
    timestamp: new Date().toISOString(),
  };

  try {
    // Call server-side API endpoint to relay request cleanly without CORS
    const res = await fetch('/api/discord-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return { success: true };
    } else {
      return { success: false, error: data.error || 'Error al enviar log a Discord' };
    }
  } catch (err: any) {
    // If backend endpoint fails, try sending directly to webhook if client has URL
    if (targetWebhookUrl) {
      try {
        const dateStr = new Date().toLocaleString('es-ES', {
          dateStyle: 'full',
          timeStyle: 'medium',
        });

        const isTest = options.eventType === 'test';
        const isLogin = options.eventType === 'login';

        const embedTitle = isTest
          ? '🤖 Prueba de Conexión con Discord Webhook'
          : isLogin
          ? '🔐 Inicio de Sesión de Usuario'
          : '📥 Nuevo Acceso a Multiverso Wiki';

        const embedColor = isTest ? 3447003 : isLogin ? 5763719 : 5814783; // Blue / Green / Indigo

        const directBody = {
          username: 'Multiverso Wiki Bot',
          avatar_url: 'https://cdn-icons-png.flaticon.com/512/3688/3688609.png',
          embeds: [
            {
              title: embedTitle,
              color: embedColor,
              fields: [
                {
                  name: '👤 Usuario',
                  value: `**${options.username}**`,
                  inline: true,
                },
                {
                  name: '🛡️ Rol',
                  value: `\`${(options.role || 'user').toUpperCase()}\``,
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

        const directRes = await fetch(targetWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(directBody),
        });

        if (directRes.ok || directRes.status === 204) {
          return { success: true };
        } else {
          return { success: false, error: `Discord respondió con estado ${directRes.status}` };
        }
      } catch (directErr: any) {
        return { success: false, error: directErr.message };
      }
    }
    return { success: false, error: err.message };
  }
};
