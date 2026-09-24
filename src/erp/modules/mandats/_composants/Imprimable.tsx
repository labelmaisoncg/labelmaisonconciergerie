import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const STYLE_ID = 'lm-style-impression';
const CSS = `
.lm-impression { display: none; }
@media print {
  body > *:not(.lm-impression) { display: none !important; }
  .lm-impression { display: block !important; min-height: 0 !important; background: #fff !important; padding: 0 !important; }
  @page { margin: 18mm 16mm; }
}`;

/**
 * Rend `children` hors de l'application, dans un conteneur visible uniquement
 * à l'impression : window.print() n'imprime alors que ce document.
 */
export function Imprimable({ children }: { children: ReactNode }) {
  const [hote, setHote] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = CSS;
      document.head.appendChild(style);
    }
    const div = document.createElement('div');
    div.className = 'erp-root lm-impression';
    document.body.appendChild(div);
    setHote(div);
    return () => {
      div.remove();
    };
  }, []);

  return hote ? createPortal(children, hote) : null;
}
