import { ChevronRight, Phone } from 'lucide-react';
import { REGLES_SCORE, type EntreeFile } from '../../../data/crm-assistant';
import { insecables } from '../../../data/format';
import { Aide, Badge, Card } from '../../../ui';

export interface FileDuJourProps {
  entrees: EntreeFile[];
  /** Ouvre le contact : prochaine action, pourquoi cette priorité, relance. */
  onOuvrir: (e: EntreeFile) => void;
}

/**
 * « À appeler ou relancer aujourd’hui » : la file de l'assistant CRM, la
 * plus prioritaire en premier. Chaque ligne se touche : le nom, puis la
 * prochaine action en une phrase ; l'appel reste à portée de pouce. Écrire
 * n'est proposé d'abord que si la prochaine action est d'écrire.
 */
export function FileDuJour({ entrees, onOuvrir }: FileDuJourProps) {
  return (
    <>
      <Card flush className="overflow-hidden">
        <ul className="divide-y divide-(--lm-bord)" aria-label="À appeler ou relancer aujourd’hui, le plus prioritaire en premier">
          {entrees.map((e) => {
            const { contact: c, profil, action } = e;
            const ville = c.ville?.trim();
            // La ville, si la phrase ne la dit pas déjà.
            const ligne = ville && !action.phrase.includes(ville) ? `${ville} · ${action.phrase}` : action.phrase;
            return (
              <li key={c.id} className="flex items-center gap-2 pr-3">
                <button
                  type="button"
                  onClick={() => onOuvrir(e)}
                  className="flex min-w-0 flex-1 items-center gap-2 py-3 pl-4 text-left hover:bg-(--lm-surface-2) focus-visible:ring-2 focus-visible:ring-(--lm-or-anneau) focus:outline-none focus-visible:ring-inset"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-[14.5px] font-medium text-(--lm-encre)">{c.nom}</span>
                      {profil === 'apporteur' && <Badge className="shrink-0">Apporteur</Badge>}
                    </span>
                    <span className="mt-0.5 block text-[13px] text-(--lm-encre-2)">{insecables(ligne)}</span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-(--lm-encre-3)" aria-hidden />
                </button>
                {c.telephone && (
                  <a
                    href={`tel:${c.telephone.replace(/[^\d+]/g, '')}`}
                    aria-label={`Appeler ${c.nom} au ${c.telephone}`}
                    className="grid size-10 shrink-0 place-items-center rounded-full bg-(--lm-or-lavis) text-(--lm-or-texte) focus-visible:ring-2 focus-visible:ring-(--lm-or-anneau) focus:outline-none"
                  >
                    <Phone className="size-[18px]" aria-hidden />
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
      <Aide titre="Comment la file est triée ?" className="mt-3">
        <p>
          En tête : les nouvelles demandes et les rappels prévus aujourd’hui, puis les relances en retard (plus le retard est long, plus elles montent). À égalité, une demande d’audit ou un dossier rempli passe
          devant un simple message, et un propriétaire devant un apporteur. Un contact qui ne répond pas après {REGLES_SCORE.appelsSansReponse} appels, ou sans téléphone ni e-mail, recule.
        </p>
        <p className="mt-1">L’ERP n’envoie ni e-mail ni SMS.</p>
      </Aide>
    </>
  );
}
