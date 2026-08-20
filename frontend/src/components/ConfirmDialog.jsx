// Modal de confirmación genérico (borrar plataforma, cancelar sync, etc.).
// No usa un primitivo Dialog de shadcn: es un overlay + Card propios,
// controlado por la prop `open` (si es false no renderiza nada).
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function ConfirmDialog({
  open,
  title = 'Confirmar',
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  return (
    <div className="confirm-dialog-overlay" onClick={onCancel}>
      <Card className="confirm-dialog-card p-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="card-title">{title}</h3>
        <p className="panel-description">{message}</p>
        <div className="confirm-dialog-actions">
          <Button type="button" variant="outline" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </Card>
    </div>
  );
}
