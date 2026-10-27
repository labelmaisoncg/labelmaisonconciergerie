import { PenLine, Phone } from 'lucide-react';
import { POINTS_ETAPE, POINTS_SOURCE, REGLES_SCORE, type EntreeFile } from '../../../data/crm-assistant';
import { Aide, Badge, Button, Card } from '../../../ui';

export interface FileDuJourProps {
  entrees: EntreeFile[];
  onOuvrir: (id: string) => void;
  onRelance: (id: string) => void;
  lectureSeule: boolean;
}

/**
 * « À appeler ou relancer aujourd’hui » : la file de l'assistant CRM, la
 * plus prioritaire en premier. Chaque ligne : le nom (fiche), la prochaine
 * action en une phrase, « Préparer la relance » (brouillon en un clic) et
 * l'appel à portée de pouce.
 */
export function FileDuJour({ entrees, onOuvrir, onRelance, lectureSeule }: FileDuJourProps) {
  const R = REGLES_SCORE;
  return (
    <>
      <Card flush>
        <ul className="divide-y divide-(--lm-bord)" aria-label="À appeler ou relancer aujourd’hui, le plus prioritaire en premier">
          {entrees.map(({ contact: c, profil, action }) => (
            <li key={c.id} className="flex items-start gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onOuvrir(c.id)}
                    className="-my-1 min-h-8 min-w-0 truncate rounded-md py-1 text-left text-[14.5px] font-medium text-(--lm-encre) hover:text-(--lm-or-texte) focus-visible:ring-2 focus-visible:ring-(--lm-or-anneau) focus:outline-none"
                  >
                    {c.nom}
                    {c.ville && <span className="font-normal text-(--lm-encre-2)"> · {c.ville}</span>}
                  </button>
                  {profil === 'apporteur' && <Badge className="shrink-0">Apporteur</Badge>}
                </div>
                <p className="mt-0.5 text-[13px] text-(--lm-encre-2)">{action.phrase}</p>
                {!lectureSeule && (c.telephone || c.email) && (
                  <Button size="sm" variant="secondary" icone={<PenLine />} className="mt-2" onClick={() => onRelance(c.id)} aria-label={`Préparer la relance de ${c.nom}`}>
                    Préparer la relance
                  </Button>
                )}
              </div>
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
          ))}
        </ul>
      </Card>
      <Aide titre="Comment la file est triée ?" className="mt-3">
        <p>Nouvelles demandes et relances prévues aujourd’hui ou en retard, comme dans l’agenda. Chaque contact reçoit des points :</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          <li>
            étape : nouvelle demande {POINTS_ETAPE.a_appeler.points}, à rappeler {POINTS_ETAPE.a_rappeler.points}, rendez-vous {POINTS_ETAPE.rendez_vous.points}, échange en cours {POINTS_ETAPE.contacte.points}, en attente {POINTS_ETAPE.en_attente.points} ;
          </li>
          <li>
            relance prévue aujourd’hui {R.relanceDuJour}, en retard {R.relanceEnRetard} plus {R.parJourDeRetard} par jour ({R.retardMax} au plus) ;
          </li>
          <li>
            demande du jour {R.demandeDuJour}, de la veille {R.demandeDeLaVeille}, de la semaine {R.demandeDeLaSemaine} ; sans nouvelles depuis {R.sansNouvellesJours} jours {R.sansNouvelles} ;
          </li>
          <li>
            source : dossier propriétaire {POINTS_SOURCE.dossier}, audit {POINTS_SOURCE.audit}, accueil du site {POINTS_SOURCE.accueil}, contact {POINTS_SOURCE.contact} ;
          </li>
          <li>
            propriétaire {R.proprietaire}, apporteur {R.apporteur} ; {R.appelsSansReponse} appels sans réponse ou plus : {R.penaliteAppels} ; ni téléphone ni e-mail : {R.sansCoordonnees}.
          </li>
        </ul>
        <p className="mt-1">Les relances sont rédigées par votre agent : relisez-les avant de les envoyer. L’ERP n’envoie ni e-mail ni SMS.</p>
      </Aide>
    </>
  );
}
