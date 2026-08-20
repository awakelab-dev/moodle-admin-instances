// Bloque de error reutilizable: muestra un mensaje y un botón "Reintentar"
// que dispara `onRetry`. Se usa en pantallas que cargan datos vía fetch
// cuando la petición falla.
import { Button } from '@/components/ui/button';

export default function ErrorRetry({ message, onRetry }) {
  return (
    <div className="cs-error-retry">
      <p className="empty error">{message}</p>
      <Button type="button" size="sm" variant="outline" onClick={onRetry}>
        Reintentar
      </Button>
    </div>
  );
}
