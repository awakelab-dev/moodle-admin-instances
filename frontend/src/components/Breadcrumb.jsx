// Migas de pan genéricas: recibe una lista de `items` ({ label, onClick? })
// y renderiza cada segmento separado por un chevron; el último item sin
// `onClick` se muestra como texto plano (posición actual).
import { ChevronRight } from 'lucide-react';

export default function Breadcrumb({ items }) {
  return (
    <div className="cs-breadcrumb">
      {items.map((item, idx) => (
        <span key={idx} className="cs-breadcrumb-segment">
          {idx > 0 && <ChevronRight size={14} className="cs-breadcrumb-sep" />}
          {item.onClick ? (
            <button type="button" className="cs-breadcrumb-link" onClick={item.onClick}>
              {item.label}
            </button>
          ) : (
            <span className="cs-breadcrumb-current">{item.label}</span>
          )}
        </span>
      ))}
    </div>
  );
}
