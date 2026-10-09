// Página "SCORM" (Moodle Insights, exclusiva de superadmin): subir
// paquetes SCORM (.zip) a S3 y reproducirlos desde ahí, sin pasar por
// Moodle. El reproductor en sí es una página estática aparte
// (public/scorm-player.html) — se abre en una pestaña nueva con la URL del
// punto de entrada del paquete en S3, no forma parte del bundle de React.
import { useEffect, useRef, useState } from 'react';
import { getScormPackages, uploadScormPackage, deleteScormPackage, BASE } from '../api';
import { formatBytes } from '@/lib/formatters';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import ConfirmDialog from './ConfirmDialog';

export default function ScormPage() {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [file, setFile] = useState(null);
  const [name, setName] = useState('');
  const [optimize, setOptimize] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [lastReport, setLastReport] = useState(null);
  const fileInputRef = useRef(null);

  function flash(text, type = 'success') {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 4000);
  }

  useEffect(() => {
    load();
  }, []);

  function load() {
    setLoading(true);
    getScormPackages()
      .then(setPackages)
      .catch((err) => flash(err.message, 'error'))
      .finally(() => setLoading(false));
  }

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) {
      flash('Elige un archivo .zip con el paquete SCORM.', 'error');
      return;
    }
    setUploading(true);
    setLastReport(null);
    try {
      const result = await uploadScormPackage(file, name, optimize);
      flash('Paquete SCORM subido.');
      setFile(null);
      setName('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (result.optimizeReport) setLastReport(result.optimizeReport);
      load();
    } catch (err) {
      flash(err.message, 'error');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteScormPackage(deleteTarget.id);
      flash(`Paquete "${deleteTarget.name}" eliminado.`);
      setDeleteTarget(null);
      setLastReport(null);
      load();
    } catch (err) {
      flash(err.message, 'error');
      setDeleteTarget(null);
    }
  }

  function openPlayer(pkg) {
    // entryPath es relativo (ej. "scorm/content/<id>/index.html") — lo
    // sirve este mismo backend (proxy a S3, que sigue siendo privado), no
    // una URL pública de S3.
    const entryUrl = `${BASE}/${pkg.entryPath}`;
    const url = `/scorm-player.html?src=${encodeURIComponent(entryUrl)}&name=${encodeURIComponent(pkg.name)}`;
    window.open(url, '_blank', 'noopener');
  }

  return (
    <div className="section-stack">
      <div className="config-header">
        <div>
          <p className="eyebrow">Moodle Insights</p>
          <h2 className="card-title section-title">SCORM</h2>
          <p className="panel-description">
            Visualizador de paquetes SCORM alojados en S3 — se sirven directamente desde el
            bucket, sin pasar por ninguna plataforma Moodle. Es un visualizador de vista previa
            (no guarda calificaciones ni progreso real de alumnos).
          </p>
        </div>
      </div>

      {msg && (
        <div style={{ position: 'fixed', bottom: '1.25rem', right: '1.25rem', zIndex: 50, maxWidth: 420 }}>
          <Alert variant={msg.type === 'error' ? 'destructive' : 'success'}>
            <AlertDescription>{msg.text}</AlertDescription>
          </Alert>
        </div>
      )}

      <Card className="p-4">
        <form onSubmit={handleUpload} className="grid gap-3.5" noValidate>
          <div className="grid grid-cols-2 gap-3.5 max-[720px]:grid-cols-1">
            <div className="grid gap-1.5">
              <Label>Archivo (.zip)</Label>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".zip,.scorm"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Nombre (opcional)</Label>
              <Input
                type="text"
                placeholder="Se usa el nombre del archivo si lo dejas vacío"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.875rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={optimize} onChange={(e) => setOptimize(e.target.checked)} />
            Optimizar automáticamente (corrige estructura anidada y nombres de archivo, comprime imágenes pesadas)
          </label>
          <div>
            <Button type="submit" disabled={uploading}>
              {uploading ? 'Subiendo…' : 'Subir paquete SCORM'}
            </Button>
          </div>
        </form>
      </Card>

      {lastReport && (
        <Card className="p-4">
          <p className="eyebrow">Resultado de la optimización</p>
          <div style={{ display: 'grid', gap: '0.5rem', marginTop: '0.5rem' }}>
            {lastReport.issues.map((issue, i) => (
              <p key={i} className="panel-description" style={{ margin: 0 }}>
                {issue.icon} {issue.text}
              </p>
            ))}
          </div>
        </Card>
      )}

      {loading ? (
        <p className="empty">Cargando paquetes…</p>
      ) : !packages.length ? (
        <p className="empty">Todavía no se ha subido ningún paquete SCORM.</p>
      ) : (
        <div className="table-wrapper insights-table-wrapper">
          <Table className="course-table">
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Archivo original</TableHead>
                <TableHead>Tamaño</TableHead>
                <TableHead>Subido por</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {packages.map((pkg) => (
                <TableRow key={pkg.id}>
                  <TableCell>{pkg.name}</TableCell>
                  <TableCell className="mono">{pkg.originalFilename}</TableCell>
                  <TableCell>{formatBytes(Number(pkg.sizeBytes))}</TableCell>
                  <TableCell>{pkg.uploadedByUsername}</TableCell>
                  <TableCell>{new Date(pkg.createdAt).toLocaleString('es-CL')}</TableCell>
                  <TableCell>
                    <div className="flex gap-2.5">
                      <Button type="button" variant="outline" size="sm" onClick={() => openPlayer(pkg)}>
                        Reproducir
                      </Button>
                      <Button type="button" variant="destructive" size="sm" onClick={() => setDeleteTarget(pkg)}>
                        Eliminar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Eliminar paquete SCORM"
        message={
          deleteTarget
            ? `¿Eliminar "${deleteTarget.name}"? Esto borra también los archivos del bucket S3. Esta acción no se puede deshacer.`
            : ''
        }
        confirmLabel="Eliminar"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
