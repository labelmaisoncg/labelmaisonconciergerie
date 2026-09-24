import { useCallback, useState } from 'react';
import { X } from 'lucide-react';
import type { Resultat } from '../../../data/store';
import { Alert, IconButton } from '../../../ui';

export interface MessageRetour {
  ton: 'succes' | 'danger' | 'info' | 'alerte';
  titre?: string;
  texte: string;
}

/** Retour d'action (succès ou refus métier) affiché en tête d'écran. */
export function useRetour() {
  const [message, setMessage] = useState<MessageRetour | null>(null);
  /** Affiche le résultat d'une mutation du store ; renvoie vrai si elle a réussi. */
  const traiter = useCallback((r: Resultat, succes: string, titreRefus = 'Action refusée') => {
    setMessage(r.ok ? { ton: 'succes', texte: succes } : { ton: 'danger', titre: titreRefus, texte: r.erreur });
    return r.ok;
  }, []);
  return { message, setMessage, traiter, fermer: () => setMessage(null) };
}

export function Retour({ message, onFermer, className }: { message: MessageRetour | null; onFermer: () => void; className?: string }) {
  if (!message) return null;
  return (
    <Alert
      tone={message.ton}
      titre={message.titre}
      className={className ?? 'mb-4'}
      actions={
        <IconButton label="Fermer le message" size="sm" onClick={onFermer}>
          <X />
        </IconButton>
      }
    >
      {message.texte}
    </Alert>
  );
}
