/**
 * La réponse à l'avis d'un voyageur, quand l'ERP s'en occupe (publication
 * automatique des réponses, avis-auto.ts) : publiée (« Publiée sur Airbnb le
 * … »), en cours, écartée par le gérant (« Annuler »), ou à valider
 * (« Publier », « Modifier », « Ne pas répondre »). Rien de tout cela : la
 * réponse habituelle (« Proposer une réponse », Avis.tsx).
 */
import { useState } from 'react';
import { Send } from 'lucide-react';
import { Alert, Badge, Button, Textarea } from '../../../ui';
import { useErp } from '../../../data/store';
import { AUJOURDHUI, dateCourte, jourMois } from '../../../data/format';
import { problemesReponse, separerAvis } from '../../../data/avis';
import { PAR_PUBLICATION_AUTO } from '../../../data/avis-auto';
import type { ReponseAvisAuto } from '../../../data/types-programmes';
import { ErreurServeur } from '../../messagerie/_composants/serveur';
import { publierAvisValide, refuserAvis, rouvrirAvis } from './AvisAuto';

const NOMS: Record<string, string> = { airbnb: 'Airbnb', booking: 'Booking.com' };
/** « 24 sept. » cette année, « 24 sept. 2025 » sinon. */
const jour = (iso: string) => (iso.slice(0, 4) === AUJOURDHUI.slice(0, 4) ? jourMois(iso.slice(0, 10)) : dateCourte(iso.slice(0, 10)));
/** Un seul point en fin de phrase (« le 17 sept. » ne prend pas un second point). */
const point = (s: string) => (s.endsWith('.') ? s : `${s}.`);

/** Vrai si l'ERP s'occupe de cette réponse (la réponse habituelle ne s'affiche pas). */
export const reponseGeree = (ligne: ReponseAvisAuto | undefined): boolean =>
  !!ligne?.publication && ['publie', 'en_cours', 'refuse', 'a_valider'].includes(ligne.publication.statut);

/** `discret` (fiche d'un séjour) : boutons secondaires, comme « Proposer une réponse ». */
export function ReponsePubliee({ ligne, discret }: { ligne: ReponseAvisAuto; discret?: boolean }) {
  const d = useErp();
  const gerant = d.utilisateur.role === 'gerant' && !d.lectureSeule;
  const r = d.reservations.find((x) => x.id === ligne.reservationId);
  const logement = d.logements.find((l) => l.id === ligne.logementId);
  const p = ligne.publication;
  const [texte, setTexte] = useState(p.texte ?? '');
  const [edition, setEdition] = useState(!(p.texte ?? '').trim());
  const [enCours, setEnCours] = useState(false);
  const [retour, setRetour] = useState<{ ton: 'succes' | 'danger'; texte: string } | null>(null);
  const plateforme = NOMS[ligne.canal] ?? 'la plateforme';
  const par = p.par && p.par !== PAR_PUBLICATION_AUTO ? ` par ${p.par}` : '';
  const titre = <h3 className="text-[14px] font-semibold text-(--lm-encre)">Votre réponse</h3>;
  const cadre = 'mt-4 border-t border-(--lm-bord) pt-4';

  if (p.statut === 'publie') {
    return (
      <section className={cadre} aria-label="Votre réponse">
        {titre}
        <p className="mt-1 text-[13.5px] text-(--lm-encre)">{p.deja ? `Déjà une réponse sur ${plateforme}.` : point(`Publiée sur ${plateforme} le ${jour(p.publieLe ?? p.le)}${par}`)}</p>
        {p.texte && <p className="mt-2 rounded-lg bg-(--lm-surface-2) p-3 text-[13.5px] leading-relaxed whitespace-pre-line text-(--lm-encre-2)">{p.texte}</p>}
      </section>
    );
  }
  if (p.statut === 'en_cours') {
    return (
      <section className={cadre} aria-label="Votre réponse">
        {titre}
        <p className="mt-1 text-[13.5px] text-(--lm-encre)">Publication en cours sur {plateforme}.</p>
      </section>
    );
  }
  if (p.statut === 'refuse') {
    return (
      <section className={cadre} aria-label="Votre réponse">
        {titre}
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
          <p className="text-[13.5px] text-(--lm-encre)">
            {point(`Pas de réponse publiée${par}, le ${jour(p.le)}`)}
          </p>
          {gerant && (
            <button type="button" onClick={() => rouvrirAvis(d, 'reponse', ligne.id)} className="inline-flex min-h-8 items-center text-[13px] text-(--lm-encre-2) hover:text-(--lm-encre) hover:underline">
              Annuler
            </button>
          )}
        </div>
      </section>
    );
  }

  // À valider.
  const prive = r ? separerAvis(r.commentaireVoyageur).prive : '';
  const problemes = texte.trim() ? problemesReponse(texte, { nomVoyageur: r?.voyageur.nom, textePrive: prive, ...(logement ? { logement } : {}) }) : [];
  const publier = async () => {
    if (enCours) return;
    setEnCours(true);
    setRetour(null);
    try {
      setRetour({ ton: 'succes', texte: await publierAvisValide(d, 'reponse', ligne.id, texte) });
    } catch (x) {
      setRetour({ ton: 'danger', texte: x instanceof ErreurServeur || x instanceof Error ? x.message : 'La publication n’a pas abouti : réessayez dans un instant.' });
    } finally {
      setEnCours(false);
    }
  };
  return (
    <section className={cadre} aria-label="Votre réponse">
      <div className="flex items-center gap-2">
        {titre}
        <Badge tone="alerte">À valider</Badge>
      </div>
      {retour?.ton === 'succes' ? (
        <Alert tone="succes" className="mt-2">
          {retour.texte}
        </Alert>
      ) : (
        <>
          {p.raisons && p.raisons.length > 0 && <p className="mt-1 text-[13px] text-(--lm-encre-2)">{p.raisons.join(' · ')}</p>}
          {edition ? (
            <Textarea aria-label="Texte de la réponse" rows={8} value={texte} disabled={!gerant} onChange={(x) => setTexte(x.target.value)} className="mt-2" />
          ) : (
            <p className="mt-2 rounded-lg bg-(--lm-surface-2) p-3 text-[13.5px] leading-relaxed whitespace-pre-line text-(--lm-encre)">{texte}</p>
          )}
          {problemes.length > 0 && (
            <Alert tone="alerte" titre="À retirer avant de publier" className="mt-3">
              Le texte contient {problemes.join(', ')}.
            </Alert>
          )}
          {gerant ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button variant={discret ? 'secondary' : 'primary'} icone={<Send />} chargement={enCours} disabled={!texte.trim() || problemes.length > 0} onClick={() => void publier()}>
                Publier
              </Button>
              {!edition && (
                <Button variant="secondary" onClick={() => setEdition(true)}>
                  Modifier
                </Button>
              )}
              <Button variant="ghost" onClick={() => refuserAvis(d, 'reponse', ligne.id)}>
                Ne pas répondre
              </Button>
            </div>
          ) : (
            <p className="mt-2 text-[12.5px] text-(--lm-encre-2)">Le gérant valide cette réponse avant sa publication.</p>
          )}
          {retour?.ton === 'danger' && (
            <Alert tone="danger" className="mt-3">
              {retour.texte}
            </Alert>
          )}
        </>
      )}
    </section>
  );
}
