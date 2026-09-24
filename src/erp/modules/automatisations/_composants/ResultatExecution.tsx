import { CheckCircle2 } from 'lucide-react';
import { REGLES, type ResultatMoteur } from '../../../automatisations';
import { pluriel } from '../../../data/format';
import { Alert, Button } from '../../../ui';

export interface ResultatExecutionProps {
  resultat: ResultatMoteur;
  applique: boolean;
  onAppliquer: () => void;
  onFermer: () => void;
}

/** Compte rendu d'un « Lancer maintenant » : changements proposés et exceptions relevées. */
export function ResultatExecution({ resultat, applique, onAppliquer, onFermer }: ResultatExecutionProps) {
  const { changements, evenements, passes } = resultat;
  const alertes = evenements.filter((e) => e.niveau === 'alerte').length;
  const parRegle = REGLES.map((r) => ({ r, n: changements.filter((c) => c.regle === r.cle).length })).filter((x) => x.n > 0);

  if (!changements.length) {
    return (
      <Alert tone="succes" titre="Tout est à jour" actions={<Button size="sm" variant="ghost" onClick={onFermer}>Fermer</Button>}>
        Aucun changement nécessaire. {alertes ? `${pluriel(alertes, 'exception')} à traiter dans le journal.` : 'Aucune exception en attente.'}
      </Alert>
    );
  }

  return (
    <Alert
      tone={applique ? 'succes' : 'or'}
      icone={applique ? <CheckCircle2 /> : undefined}
      titre={applique ? `${pluriel(changements.length, 'changement')} appliqué${changements.length > 1 ? 's' : ''}` : `${pluriel(changements.length, 'changement')} prêt${changements.length > 1 ? 's' : ''} (${pluriel(passes, 'passe')})`}
      actions={
        <>
          {!applique && <Button size="sm" variant="primary" onClick={onAppliquer}>Appliquer</Button>}
          <Button size="sm" variant="ghost" onClick={onFermer}>Fermer</Button>
        </>
      }
    >
      <ul className="mt-1 space-y-0.5">
        {parRegle.map(({ r, n }) => (
          <li key={r.cle}>
            <span className="lm-chiffres font-medium">{n}</span> · {r.nom}
          </li>
        ))}
      </ul>
      {alertes > 0 && <p className="mt-1.5">{pluriel(alertes, 'exception')} relevée{alertes > 1 ? 's' : ''} : voir les alertes du journal.</p>}
    </Alert>
  );
}
