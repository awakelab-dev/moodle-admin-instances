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
