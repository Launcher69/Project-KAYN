import React, { useState, useRef } from 'react';
import { User } from '../types';
import { X, Lock, Check, KeyRound, Sparkles, AlertCircle, Palette, Upload, Image as ImageIcon, Trash2, Link as LinkIcon } from 'lucide-react';
import { playSound } from '../utils/soundEffects';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onUpdateUser: (updatedUser: User) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUpdateUser,
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [avatarColor, setAvatarColor] = useState(currentUser.avatarColor || 'bg-indigo-600');
  const [imageUrlInput, setImageUrlInput] = useState(currentUser.avatarUrl || '');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('La imagen no debe superar los 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        const updated: User = {
          ...currentUser,
          avatarUrl: result,
        };
        onUpdateUser(updated);
        setImageUrlInput(result);
        playSound('click');
        setSuccess('¡Foto de perfil actualizada!');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleApplyImageUrl = () => {
    const cleanUrl = imageUrlInput.trim();
    const updated: User = {
      ...currentUser,
      avatarUrl: cleanUrl || undefined,
    };
    onUpdateUser(updated);
    playSound('click');
    setSuccess(cleanUrl ? '¡URL de foto actualizada!' : '¡Foto de perfil eliminada!');
  };

  const handleRemoveAvatarImage = () => {
    const updated: User = {
      ...currentUser,
      avatarUrl: undefined,
    };
    setImageUrlInput('');
    onUpdateUser(updated);
    playSound('click');
    setSuccess('Foto de perfil eliminada. Se usará el avatar con color.');
  };

  const handleSavePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (currentPassword !== currentUser.password) {
      setError('La contraseña actual es incorrecta');
      return;
    }
    if (newPassword.length < 4) {
      setError('La nueva contraseña debe tener al menos 4 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    const updated: User = {
      ...currentUser,
      password: newPassword,
      avatarColor,
    };

    playSound('click');
    onUpdateUser(updated);
    setSuccess('¡Contraseña actualizada con éxito!');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const colorOptions = [
    { label: 'Índigo', class: 'bg-indigo-600' },
    { label: 'Púrpura', class: 'bg-purple-600' },
    { label: 'Esmeralda', class: 'bg-emerald-600' },
    { label: 'Ámbar', class: 'bg-amber-600' },
    { label: 'Rosa', class: 'bg-rose-600' },
    { label: 'Cian', class: 'bg-cyan-600' },
    { label: 'Azul', class: 'bg-blue-600' },
  ];

  const handleColorChange = (colorClass: string) => {
    setAvatarColor(colorClass);
    const updated: User = {
      ...currentUser,
      avatarColor: colorClass,
    };
    onUpdateUser(updated);
    playSound('click');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Configuración de Cuenta</h2>
              <p className="text-xs text-slate-400">@{currentUser.username}</p>
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

        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Profile Picture Section */}
          <div className="space-y-3">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
              <ImageIcon className="w-3.5 h-3.5 text-indigo-400" />
              <span>Imagen de Perfil</span>
            </label>

            <div className="flex items-center gap-4 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
              {/* Avatar Preview */}
              <div className="relative w-14 h-14 rounded-full overflow-hidden shrink-0 border-2 border-indigo-500/40 shadow-lg group">
                {currentUser.avatarUrl ? (
                  <img
                    src={currentUser.avatarUrl}
                    alt={currentUser.username}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div
                    className={`w-full h-full ${currentUser.avatarColor || 'bg-indigo-600'} flex items-center justify-center text-white font-bold text-lg uppercase`}
                  >
                    {currentUser.username.slice(0, 2)}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-lg transition-colors cursor-pointer shadow-sm"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Subir Foto</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowUrlInput((prev) => !prev)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition-colors cursor-pointer"
                  >
                    <LinkIcon className="w-3.5 h-3.5" />
                    <span>URL</span>
                  </button>

                  {currentUser.avatarUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveAvatarImage}
                      className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs rounded-lg transition-colors cursor-pointer"
                      title="Quitar foto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {showUrlInput && (
                  <div className="flex items-center gap-1.5 mt-1 animate-in fade-in duration-150">
                    <input
                      type="text"
                      value={imageUrlInput}
                      onChange={(e) => setImageUrlInput(e.target.value)}
                      placeholder="https://ejemplo.com/avatar.jpg"
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={handleApplyImageUrl}
                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-lg cursor-pointer shrink-0"
                    >
                      Guardar
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Avatar Color Picker (Fallback) */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 mb-2">
              <Palette className="w-3.5 h-3.5 text-indigo-400" />
              <span>Color de Fondo (Avatar por defecto)</span>
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {colorOptions.map((c) => (
                <button
                  key={c.class}
                  type="button"
                  onClick={() => handleColorChange(c.class)}
                  className={`w-8 h-8 rounded-full ${c.class} border-2 transition-all flex items-center justify-center cursor-pointer ${
                    avatarColor === c.class ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                  title={c.label}
                >
                  {avatarColor === c.class && <Check className="w-4 h-4 text-white" />}
                </button>
              ))}
            </div>
          </div>

          {/* Change Password Form */}
          <form onSubmit={handleSavePassword} className="space-y-4 pt-4 border-t border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-indigo-400" />
              <span>Cambiar Contraseña</span>
            </h3>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-300 text-xs animate-in fade-in">
                <Check className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{success}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Contraseña Actual
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Nueva Contraseña
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Confirmar Nueva Contraseña
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-indigo-500/25 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>Guardar Nueva Contraseña</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
