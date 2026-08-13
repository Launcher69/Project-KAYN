import React, { useState } from 'react';
import { User } from '../types';
import { X, User as UserIcon, Lock, UserPlus, LogIn, Sparkles, AlertCircle } from 'lucide-react';
import { playSound } from '../utils/soundEffects';
import { sendDiscordLog } from '../utils/discordLogger';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: User) => void;
  users: User[];
  onRegisterUser: (newUser: User) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  users,
  onRegisterUser,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanUsername = username.trim();
    if (!cleanUsername) {
      setError('Por favor introduce un nombre de usuario');
      return;
    }
    if (cleanUsername.toLowerCase() !== 'invitado' && !password) {
      setError('Por favor introduce tu contraseña');
      return;
    }

    if (mode === 'login') {
      try {
        const res = await fetch('/api/users/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: cleanUsername, password: password || '' }),
        });
        const data = await res.json();
        if (res.ok && data.success && data.user) {
          playSound('click');
          onLoginSuccess(data.user);
          sendDiscordLog({
            username: data.user.username,
            role: data.user.role,
            avatarUrl: data.user.avatarUrl,
            eventType: 'login',
          });
          onClose();
          return;
        } else {
          setError(data.error || 'Nombre de usuario o contraseña incorrectos');
          return;
        }
      } catch (err) {
        const existingUser = users.find(
          (u) => u.username.toLowerCase() === cleanUsername.toLowerCase()
        );
        if (!existingUser) {
          setError('No existe ningún usuario con este nombre');
          return;
        }
        if (existingUser.username.toLowerCase() !== 'invitado' && existingUser.password !== password) {
          setError('Contraseña incorrecta');
          return;
        }

        playSound('click');
        onLoginSuccess(existingUser);
        onClose();
      }
    } else {
      if (cleanUsername.toLowerCase() === 'invitado' || cleanUsername.toLowerCase() === 'admin') {
        setError('Ese nombre de usuario está reservado por el sistema');
        return;
      }
      if (password.length < 4) {
        setError('La contraseña debe tener al menos 4 caracteres');
        return;
      }
      if (password !== confirmPassword) {
        setError('Las contraseñas no coinciden');
        return;
      }

      try {
        const res = await fetch('/api/users/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: cleanUsername, password }),
        });
        const data = await res.json();
        if (res.ok && data.success && data.user) {
          playSound('click');
          onRegisterUser(data.user);
          onLoginSuccess(data.user);
          onClose();
          return;
        } else {
          setError(data.error || 'Error al registrar usuario');
          return;
        }
      } catch (err) {
        const colors = ['bg-indigo-600', 'bg-purple-600', 'bg-emerald-600', 'bg-amber-600', 'bg-rose-600', 'bg-cyan-600'];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];

        const guestUser = users.find((u) => u.username.toLowerCase() === 'invitado' || u.role === 'guest');
        const guestAllowedWorlds = guestUser?.allowedWorldIds ? [...guestUser.allowedWorldIds] : [];

        const newUser: User = {
          id: `user_${Date.now()}`,
          username: cleanUsername,
          password,
          role: cleanUsername.toLowerCase() === 'admin' ? 'admin' : 'user',
          allowedWorldIds: cleanUsername.toLowerCase() === 'admin' ? null : guestAllowedWorlds,
          favorites: [],
          avatarColor: randomColor,
          createdAt: new Date().toISOString(),
        };

        playSound('click');
        onRegisterUser(newUser);
        onLoginSuccess(newUser);
        onClose();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <UserIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {mode === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'}
              </h2>
              <p className="text-xs text-slate-400">Multiverse Lore Wiki</p>
            </div>
          </div>
          <button
            onClick={() => {
              playSound('click');
              onClose();
            }}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="p-1 mx-6 mt-5 bg-slate-950 rounded-xl border border-slate-800/80 flex gap-1">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
              playSound('click');
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              mode === 'login'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Iniciar Sesión</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError(null);
              playSound('click');
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              mode === 'register'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Registrarse</span>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Nombre de Usuario
            </label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ej. ExploradorLore"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Contraseña
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              />
            </div>
          </div>

          {mode === 'register' && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Confirmar Contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-indigo-500/25 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>{mode === 'login' ? 'Acceder a la Wiki' : 'Completar Registro'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
