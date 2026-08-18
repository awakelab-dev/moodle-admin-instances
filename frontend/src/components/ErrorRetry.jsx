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
