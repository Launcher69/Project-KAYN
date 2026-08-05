import React, { useState } from 'react';
import { User, WikiItem } from '../types';
import { X, ShieldCheck, Globe, Check, Lock, Trash2, UserPlus, Sparkles, Search, User as UserIcon } from 'lucide-react';
import { playSound } from '../utils/soundEffects';

interface AdminUsersModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  wikiData: WikiItem[];
  onUpdateUserPermissions: (userId: string, allowedWorldIds: string[] | null) => Promise<void>;
  onUpdateUserRole: (userId: string, role: 'admin' | 'user') => Promise<void>;
  onDeleteUser: (userId: string) => Promise<void>;
  onRegisterUserByAdmin: (user: User) => Promise<void>;
}

export const AdminUsersModal: React.FC<AdminUsersModalProps> = ({
  isOpen,
  onClose,
  users,
  wikiData,
  onUpdateUserPermissions,
  onUpdateUserRole,
  onDeleteUser,
  onRegisterUserByAdmin,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [addUserError, setAddUserError] = useState<string | null>(null);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: 'delete' | 'toggleRole';
    user: User;
    title: string;
    message: string;
  } | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Extract all world entities
  const worldEntities = wikiData.filter(
    (item) => item.tipo === 'mundo' || item.id.startsWith('mundo_')
  );

  const filteredUsers = users.filter((u) =>
    u.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeUser = users.find((u) => u.id === selectedUserId) || users[0] || null;

  const handleToggleWorldPermission = async (user: User, worldItem: WikiItem) => {
    playSound('click');
    setSavingUserId(user.id);
    try {
      const keys = [...new Set([worldItem.id, worldItem.mundo_id].filter(Boolean))] as string[];
      let currentAllowed = user.allowedWorldIds;
      if (currentAllowed === null || currentAllowed === undefined) {
        // Currently has access to all worlds; toggling off this world means allowing all minus these keys
        const allKeys = new Set(worldEntities.flatMap((w) => [w.id, w.mundo_id].filter(Boolean) as string[]));
        keys.forEach((k) => allKeys.delete(k));
        currentAllowed = Array.from(allKeys);
      } else {
        const isCurrentlyAllowed = user.allowedWorldIds.some((id) => keys.includes(id));
        if (isCurrentlyAllowed) {
          currentAllowed = currentAllowed.filter((id) => !keys.includes(id));
        } else {
          currentAllowed = [...new Set([...currentAllowed, ...keys])];
        }
      }

      await onUpdateUserPermissions(user.id, currentAllowed);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingUserId(null);
    }
  };

  const handleSetAllWorlds = async (user: User, allowAll: boolean) => {
    playSound('click');
    setSavingUserId(user.id);
    try {
      const allowed = allowAll ? null : [];
      await onUpdateUserPermissions(user.id, allowed);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingUserId(null);
    }
  };

  const handleToggleRole = (user: User) => {
    if (user.username.toLowerCase() === 'admin' || user.username.toLowerCase() === 'invitado') {
      setNoticeMessage('No se puede cambiar el rol de las cuentas especiales del sistema (admin / invitado).');
      return;
    }
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    const confirmTitle = newRole === 'admin' ? `Hacer Administrador a @${user.username}` : `Quitar Administrador a @${user.username}`;
    const confirmMessage = newRole === 'admin'
      ? `¿Estás seguro de que deseas conceder permisos de ADMINISTRADOR a @${user.username}? Tendrá acceso total a todos los mundos y al panel de control.`
      : `¿Deseas quitar los permisos de administrador a @${user.username}? Pasará a ser un usuario estándar.`;

    setConfirmAction({
      type: 'toggleRole',
      user,
      title: confirmTitle,
      message: confirmMessage,
    });
  };

  const handleConfirmDelete = (user: User) => {
    if (user.username.toLowerCase() === 'admin' || user.username.toLowerCase() === 'invitado') {
      setNoticeMessage('No se puede eliminar las cuentas reservadas del sistema (admin / invitado).');
      return;
    }
    setConfirmAction({
      type: 'delete',
      user,
      title: `Eliminar cuenta de @${user.username}`,
      message: `⚠️ ¿Estás seguro de que deseas eliminar permanentemente la cuenta @${user.username}? Esta acción no se puede deshacer.`,
    });
  };

  const executeConfirmAction = async () => {
    if (!confirmAction) return;
    const { type, user } = confirmAction;
    setConfirmAction(null);
    playSound('click');
    setSavingUserId(user.id);
    try {
      if (type === 'delete') {
        await onDeleteUser(user.id);
        if (selectedUserId === user.id) {
          setSelectedUserId(null);
        }
      } else if (type === 'toggleRole') {
        const newRole = user.role === 'admin' ? 'user' : 'admin';
        await onUpdateUserRole(user.id, newRole);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingUserId(null);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddUserError(null);
    const cleanName = newUsername.trim();
    if (!cleanName || !newPassword) {
      setAddUserError('Por favor introduce nombre y contraseña');
      return;
    }

    const existing = users.find((u) => u.username.toLowerCase() === cleanName.toLowerCase());
    if (existing) {
      setAddUserError('Ya existe un usuario con ese nombre');
      return;
    }

    const colors = ['bg-indigo-600', 'bg-purple-600', 'bg-emerald-600', 'bg-amber-600', 'bg-rose-600', 'bg-cyan-600'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const guestUser = users.find((u) => u.username.toLowerCase() === 'invitado' || u.role === 'guest');
    const guestAllowedWorlds = guestUser?.allowedWorldIds ? [...guestUser.allowedWorldIds] : [];
    const isAdmin = cleanName.toLowerCase() === 'admin';

    const newUser: User = {
      id: `user_${Date.now()}`,
      username: cleanName,
      password: newPassword,
      role: isAdmin ? 'admin' : 'user',
      allowedWorldIds: isAdmin ? null : guestAllowedWorlds,
      favorites: [],
      avatarColor: randomColor,
      createdAt: new Date().toISOString(),
    };

    playSound('click');
    await onRegisterUserByAdmin(newUser);
    setNewUsername('');
    setNewPassword('');
    setShowAddUser(false);
    setSelectedUserId(newUser.id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 text-indigo-400 shadow-sm">
              <ShieldCheck className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Panel de Administración de Usuarios</h2>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 rounded-full">
                  Admin Access
                </span>
              </div>
              <p className="text-xs text-slate-400">Control de permisos de lectura y acceso a mundos del Multiverso</p>
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

        {/* Content split into Left (User List) and Right (World Permissions) */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 divide-y md:divide-y-0 md:divide-x divide-slate-800/80">
          
          {/* Left Column: User List */}
          <div className="w-full md:w-80 flex flex-col bg-slate-950/40 p-4 shrink-0">
            <div className="flex items-center justify-between mb-3 gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar usuario..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAddUser((prev) => !prev);
                  playSound('click');
                }}
                className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-colors cursor-pointer shadow-md shrink-0"
                title="Crear nuevo usuario"
              >
                <UserPlus className="w-4 h-4" />
              </button>
            </div>

            {/* Form to add user */}
            {showAddUser && (
              <form onSubmit={handleCreateUser} className="mb-3 p-3 bg-slate-900 border border-indigo-500/30 rounded-xl space-y-2.5 animate-in fade-in">
                <h4 className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Crear Nuevo Usuario</span>
                </h4>
                {addUserError && (
                  <p className="text-[11px] text-rose-400">{addUserError}</p>
                )}
                <input
                  type="text"
                  placeholder="Nombre de usuario"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
                <input
                  type="password"
                  placeholder="Contraseña"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAddUser(false)}
                    className="px-2.5 py-1 text-xs text-slate-400 hover:text-white"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-sm"
                  >
                    Crear
                  </button>
                </div>
              </form>
            )}

            {/* Users list */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {filteredUsers.map((u) => {
                const isSelected = activeUser?.id === u.id;
                const isAdmin = u.role === 'admin' || u.username.toLowerCase() === 'admin';
                const allowedCount = u.allowedWorldIds === null || u.allowedWorldIds === undefined
                  ? 'Todos'
                  : `${u.allowedWorldIds.length}/${worldEntities.length}`;

                return (
                  <div
                    key={u.id}
                    onClick={() => {
                      setSelectedUserId(u.id);
                      playSound('click');
                    }}
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600/20 border-indigo-500/60 shadow-md'
                        : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-800/50 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {u.avatarUrl ? (
                        <img
                          src={u.avatarUrl}
                          alt={u.username}
                          className="w-8 h-8 rounded-full object-cover shrink-0 border border-slate-700"
                        />
                      ) : (
                        <div
                          className={`w-8 h-8 rounded-full ${u.avatarColor || 'bg-indigo-600'} flex items-center justify-center text-white font-bold text-xs uppercase shrink-0 shadow-sm`}
                        >
                          {u.username.slice(0, 2)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-white truncate">@{u.username}</span>
                          {isAdmin && (
                            <span title="Administrador">
                              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                            </span>
                          )}
                          {u.username.toLowerCase() === 'invitado' && (
                            <span className="px-1.5 py-0.2 text-[9px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded">
                              DEFECTO
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 block">
                          Mundos: <span className="text-indigo-300 font-semibold">{allowedCount}</span>
                        </span>
                      </div>
                    </div>

                    {u.username.toLowerCase() !== 'admin' && u.username.toLowerCase() !== 'invitado' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleConfirmDelete(u);
                        }}
                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                        title="Eliminar usuario"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: World Permissions Configurator for Selected User */}
          <div className="flex-1 flex flex-col p-6 overflow-y-auto bg-slate-900/50">
            {activeUser ? (
              <div className="space-y-6">
                {/* User Info Header */}
                <div className="flex items-center justify-between p-4 bg-slate-950/80 border border-slate-800 rounded-xl">
                  <div className="flex items-center gap-3">
                    {activeUser.avatarUrl ? (
                      <img
                        src={activeUser.avatarUrl}
                        alt={activeUser.username}
                        className="w-10 h-10 rounded-full object-cover border-2 border-indigo-500/40"
                      />
                    ) : (
                      <div className={`w-10 h-10 rounded-full ${activeUser.avatarColor || 'bg-indigo-600'} flex items-center justify-center text-white font-bold text-sm uppercase shadow-inner`}>
                        {activeUser.username.slice(0, 2)}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-white">@{activeUser.username}</h3>
                        {activeUser.role === 'admin' ? (
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-md">
                            Administrador (Acceso Total)
                          </span>
                        ) : activeUser.username.toLowerCase() === 'invitado' ? (
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-md">
                            Perfil Público Inicial (Invitado)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700 rounded-md">
                            Usuario Estándar
                          </span>
                        )}
                      </div>
                      {activeUser.username.toLowerCase() === 'invitado' ? (
                        <p className="text-xs text-amber-400/90 font-medium">
                          Sin contraseña — Aplica automáticamente a los usuarios que entran por primera vez sin iniciar sesión
                        </p>
                      ) : (
                        <p className="text-xs text-slate-400">Contraseña: <span className="font-mono text-slate-300">••••••••</span></p>
                      )}
                    </div>
                  </div>

                  {activeUser.username.toLowerCase() !== 'invitado' && activeUser.username.toLowerCase() !== 'admin' && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleRole(activeUser)}
                        className={`px-2.5 py-1.5 font-semibold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 border ${
                          activeUser.role === 'admin'
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
                            : 'bg-purple-600/20 border-purple-500/30 text-purple-300 hover:bg-purple-600/30'
                        }`}
                        title={activeUser.role === 'admin' ? 'Quitar rol de administrador' : 'Convertir en administrador'}
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>{activeUser.role === 'admin' ? 'Quitar Admin' : 'Hacer Admin'}</span>
                      </button>

                      {activeUser.role !== 'admin' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleSetAllWorlds(activeUser, true)}
                            className="px-2.5 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 font-semibold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Permitir Todos</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetAllWorlds(activeUser, false)}
                            className="px-2.5 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 font-semibold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                          >
                            <Lock className="w-3.5 h-3.5" />
                            <span>Bloquear Todos</span>
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* World Permissions Grid */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                    <Globe className="w-4 h-4 text-indigo-400" />
                    <span>Permisos de Acceso a Mundos ({worldEntities.length})</span>
                  </h4>

                  {activeUser.role === 'admin' ? (
                    <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-200 text-xs flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0" />
                      <span>El usuario Administrador tiene acceso garantizado a todos los mundos del sistema sin restricciones.</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {worldEntities.map((world) => {
                        const keys = [world.id, world.mundo_id].filter(Boolean) as string[];
                        const isAllowed =
                          activeUser.allowedWorldIds === null ||
                          activeUser.allowedWorldIds === undefined ||
                          activeUser.allowedWorldIds.some((id) => keys.includes(id));

                        return (
                          <div
                            key={world.id}
                            onClick={() => handleToggleWorldPermission(activeUser, world)}
                            className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer select-none ${
                              isAllowed
                                ? 'bg-indigo-950/40 border-indigo-500/50 hover:bg-indigo-900/30'
                                : 'bg-slate-950/60 border-slate-800 opacity-60 hover:opacity-100 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className={`p-2 rounded-lg shrink-0 ${
                                  isAllowed ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-500'
                                }`}
                              >
                                <Globe className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-white truncate">{world.nombre}</p>
                                <p className="text-[10px] text-slate-400 truncate">ID: {world.id}</p>
                              </div>
                            </div>

                            <div className="shrink-0 ml-2">
                              {isAllowed ? (
                                <span className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-md">
                                  <Check className="w-3 h-3" />
                                  Permitido
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-md">
                                  <Lock className="w-3 h-3" />
                                  Restringido
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center text-slate-500">
                <UserIcon className="w-12 h-12 mb-2 opacity-30" />
                <p className="text-xs">Selecciona un usuario de la lista de la izquierda para ver y gestionar sus permisos.</p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Confirmation Modal Overlay */}
      {confirmAction && (
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${confirmAction.type === 'delete' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'}`}>
                {confirmAction.type === 'delete' ? <Trash2 className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
              </div>
              <div>
                <h3 className="text-base font-bold text-white">{confirmAction.title}</h3>
                <p className="text-xs text-slate-400">Confirmación requerida</p>
              </div>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
              {confirmAction.message}
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={executeConfirmAction}
                className={`px-4 py-2 text-xs font-semibold text-white rounded-xl shadow-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                  confirmAction.type === 'delete'
                    ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-900/30'
                    : 'bg-purple-600 hover:bg-purple-500 shadow-purple-900/30'
                }`}
              >
                {confirmAction.type === 'delete' ? 'Sí, eliminar cuenta' : 'Sí, confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notice Modal Overlay */}
      {noticeMessage && (
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <div className="p-2 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white">Acción no permitida</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/70 p-3 rounded-xl border border-slate-800">
              {noticeMessage}
            </p>
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setNoticeMessage(null)}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
