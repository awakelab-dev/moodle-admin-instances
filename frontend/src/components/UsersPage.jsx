// Página "Usuarios" (Configuración → Usuarios, exclusiva de superadmin):
// alta/edición/baja de usuarios del dashboard y, para los de rol "limited",
// qué plataformas puede ver cada uno en Moodle Insights. Los "admin" ven
// siempre todas las plataformas, por eso el bloque de checkboxes solo se
// muestra cuando el rol elegido es "limited".
import { useState, useEffect } from 'react';
import { getUsers, createUser, updateUser, deleteUser, getPlatforms } from '../api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatPlatformDisplayName } from '@/lib/utils';
import ConfirmDialog from './ConfirmDialog';

const EMPTY_FORM = {
  username: '',
  displayName: '',
  password: '',
  role: 'limited',
  platformIds: [],
};

const ROLE_LABELS = {
  admin: 'Superadmin',
  limited: 'Usuario',
};

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [platforms, setPlatforms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    load();
  }, []);

  function load() {
    setLoading(true);
    Promise.all([getUsers(), getPlatforms()])
      .then(([usersData, platformsData]) => {
        setUsers(usersData);
        setPlatforms(
          [...platformsData].sort((a, b) =>
            formatPlatformDisplayName(a.name).localeCompare(formatPlatformDisplayName(b.name))
          )
        );
      })
      .catch((err) => flash(err.message, 'error'))
      .finally(() => setLoading(false));
  }

  function flash(text, type = 'success') {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 4000);
  }

  function openAdd() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
  }

  function openEdit(user) {
    setForm({
      username: user.username,
      displayName: user.displayName,
      password: '',
      role: user.role,
      platformIds: user.platforms.map((p) => p.id),
    });
    setEditingId(user.id);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function togglePlatform(platformId) {
    setForm((prev) => ({
      ...prev,
      platformIds: prev.platformIds.includes(platformId)
        ? prev.platformIds.filter((id) => id !== platformId)
        : [...prev.platformIds, platformId],
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingId !== null) {
        const payload = {
          username: form.username.trim(),
          displayName: form.displayName.trim(),
          role: form.role,
          platformIds: form.platformIds,
        };
        if (form.password.trim()) payload.password = form.password.trim();
        await updateUser(editingId, payload);
        flash('Usuario actualizado.');
      } else {
        await createUser({
          username: form.username.trim(),
          displayName: form.displayName.trim(),
          password: form.password.trim(),
          role: form.role,
          platformIds: form.platformIds,
        });
        flash('Usuario creado.');
      }
      closeForm();
      load();
    } catch (err) {
      flash(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteUser(deleteTarget.id);
      flash(`Usuario "${deleteTarget.displayName}" eliminado.`);
      setDeleteTarget(null);
      load();
    } catch (err) {
      flash(err.message, 'error');
      setDeleteTarget(null);
    }
  }

  if (loading) return <p className="empty">Cargando usuarios…</p>;

  return (
    <div className="section-stack">
      <div className="config-header">
        <div>
          <p className="eyebrow">Configuración</p>
          <h2 className="card-title section-title">Usuarios</h2>
          <p className="panel-description">
            Solo los superadmin pueden crear usuarios y acceder a Storage y Configuración.
            Los usuarios normales solo ven Moodle Insights, limitado a las plataformas que
            se les asignen aquí.
          </p>
        </div>
        <Button onClick={openAdd}>+ Agregar usuario</Button>
      </div>

      {msg && (
        <Alert variant={msg.type === 'error' ? 'destructive' : 'success'}>
          <AlertDescription>{msg.text}</AlertDescription>
        </Alert>
      )}

      {showForm && (
        <Card className="p-4 pt-4">
          <div className="panel-header panel-header-compact">
            <div>
              <p className="eyebrow">{editingId !== null ? 'Edición' : 'Nuevo usuario'}</p>
              <h3 className="card-title">{editingId !== null ? 'Editar usuario' : 'Nuevo usuario'}</h3>
            </div>
          </div>
          <form onSubmit={handleSubmit} className="grid gap-3.5">
            <div className="grid grid-cols-2 gap-3.5 max-[720px]:grid-cols-1">
              <div className="grid gap-1.5">
                <Label>Usuario</Label>
                <Input
                  type="text"
                  placeholder="usuario.acceso"
                  autoComplete="off"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Nombre para mostrar</Label>
                <Input
                  type="text"
                  placeholder="Nombre Apellido"
                  autoComplete="off"
                  value={form.displayName}
                  onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Contraseña{editingId !== null ? ' (dejar vacío para mantener la actual)' : ''}</Label>
                <Input
                  type="password"
                  placeholder="Mínimo 8 caracteres"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required={editingId === null}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Rol</Label>
                <Select value={form.role} onValueChange={(value) => setForm({ ...form, role: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="limited">Usuario (solo Moodle Insights, plataformas asignadas)</SelectItem>
                    <SelectItem value="admin">Superadmin (acceso total)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {form.role === 'limited' && (
              <div className="grid gap-1.5">
                <Label>Plataformas visibles para este usuario</Label>
                {!platforms.length ? (
                  <p className="empty">No hay plataformas configuradas todavía.</p>
                ) : (
                  <div className="cs-role-filter" style={{ flexWrap: 'wrap' }}>
                    {platforms.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className={`cs-role-chip ${form.platformIds.includes(p.id) ? 'active' : ''}`}
                        onClick={() => togglePlatform(p.id)}
                      >
                        {formatPlatformDisplayName(p.name)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2.5">
              <Button type="submit" disabled={saving}>
                {saving ? 'Guardando…' : editingId !== null ? 'Guardar cambios' : 'Crear usuario'}
              </Button>
              <Button type="button" variant="outline" onClick={closeForm}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}

      {!users.length ? (
        <p className="empty">No hay usuarios configurados todavía.</p>
      ) : (
        <div className="platform-list">
          {users.map((user) => (
            <Card key={user.id} className="platform-card p-4">
              <div className="platform-info">
                <div className="platform-name">{user.displayName}</div>
                <div className="platform-url">@{user.username}</div>
                <div className="platform-toggle-row flex items-center gap-2.5">
                  <Badge variant={user.role === 'admin' ? 'secondary' : 'outline'}>
                    {ROLE_LABELS[user.role] || user.role}
                  </Badge>
                </div>
                {user.role === 'limited' && (
                  <p className="history-note">
                    {user.platforms.length
                      ? `Ve: ${user.platforms.map((p) => formatPlatformDisplayName(p.name)).join(', ')}`
                      : 'Sin plataformas asignadas todavía — no verá ningún dato en Moodle Insights.'}
                  </p>
                )}
              </div>
              <div className="platform-actions">
                <Button type="button" variant="outline" onClick={() => openEdit(user)}>
                  Editar
                </Button>
                <Button type="button" variant="destructive" onClick={() => setDeleteTarget(user)}>
                  Eliminar
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Eliminar usuario"
        message={deleteTarget ? `¿Eliminar a "${deleteTarget.displayName}"? Esta acción no se puede deshacer.` : ''}
        confirmLabel="Eliminar"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
