/**
 * « Avis sur le voyageur » d'un séjour Airbnb terminé : le texte préparé
 * (par l'IA du serveur, ou un texte simple), à copier puis coller sur
 * Airbnb. L'ERP ne publie rien : « Ouvrir Airbnb » est un simple lien.
 * Ensuite « C’est fait » ou « Passer ». Un séjour avec incident, note basse
 * ou message négatif est « à relire », jamais présenté comme prêt.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Copy, ExternalLink } from 'lucide-react';
import { Alert, Badge, Button, Card, CardHeader, Textarea, classesBouton, type Ton } from '../../../ui';
import { useErp } from '../../../data/store';
import { AUJOURDHUI, dateCourte, horodatageMaintenant, jourMois, pluriel } from '../../../data/format';
import { LIEN_AIRBNB_HOTE, avisATraiter, etatAvis, prenomDe } from '../../../data/messages-programmes';
import type { Reservation } from '../../../data/types';
import type { AvisADeposer, StatutAvisADeposer } from '../../../data/types-programmes';

const BADGES: Record<StatutAvisADeposer, { libelle: string; ton: Ton }> = {
  a_rediger: { libelle: 'À déposer', ton: 'or' },
  pret: { libelle: 'Prêt', ton: 'or' },
  a_relire: { libelle: 'À relire', ton: 'alerte' },
  fait: { libelle: 'Déposé', ton: 'succes' },
  passe: { libelle: 'Passé', ton: 'neutre' },
};

export function CarteAvisADeposer({ r }: { r: Reservation }) {
  const d = useErp();
  const etat = etatAvis(d, r, AUJOURDHUI);
  // Texte préparé (il suit le serveur) tant que l'équipe ne l'a pas retouché.
  const [retouche, setTexte] = useState<string | null>(null);
  const texte = retouche ?? etat?.texte ?? '';
  const [copie, setCopie] = useState<'ok' | 'echec' | null>(null);

  if (!etat) return null;
  const traite = etat.statut === 'fait' || etat.statut === 'passe';
  const badge = BADGES[etat.statut];
  const suivant = traite ? avisATraiter(d, AUJOURDHUI).find((x) => x.reservation.id !== r.id) : undefined;
  const modifiable = !d.lectureSeule;

  const ligne = (statut: StatutAvisADeposer, extra: Partial<AvisADeposer> = {}): AvisADeposer => ({
    id: r.id,
    reservationId: r.id,
    logementId: r.logementId,
    voyageur: prenomDe(r.voyageur.nom) || 'Voyageur',
    depart: r.depart,
    canal: r.canal,
    creeLe: etat.avis?.creeLe ?? horodatageMaintenant(),
    ...(etat.avis ?? {}),
    statut,
    ...extra,
  });

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(texte.trim());
      setCopie('ok');
    } catch {
      setCopie('echec');
    }
  };

  const terminer = (statut: 'fait' | 'passe') => {
    const retouche = texte.trim() !== (etat.avis?.texte ?? '').trim();
    d.upsert('avisADeposer', ligne(statut, { texte: texte.trim(), ...(retouche ? { source: 'equipe' } : {}), traiteLe: horodatageMaintenant(), traitePar: d.utilisateur.nom }));
  };

  // Annuler « C’est fait » / « Passer » : l'avis revient à déposer (relu si besoin).
  const rouvrir = () => {
    const x = ligne(etat.raisons.length ? 'a_relire' : etat.avis?.texte ? 'pret' : 'a_rediger');
    delete x.traiteLe;
    delete x.traitePar;
    d.upsert('avisADeposer', x);
  };

  return (
    <Card id="avis">
      <CardHeader titre="Avis sur le voyageur" actions={<Badge tone={badge.ton}>{badge.libelle}</Badge>} />

      {traite ? (
        <>
          <p className="text-[13.5px] text-(--lm-encre)">
            {etat.statut === 'fait' ? 'Avis déposé sur Airbnb' : 'Avis passé, pas déposé'}
            {etat.avis?.traiteLe ? ` le ${(etat.avis.traiteLe.slice(0, 4) === AUJOURDHUI.slice(0, 4) ? jourMois : dateCourte)(etat.avis.traiteLe.slice(0, 10))}` : ''}
            {etat.avis?.traitePar ? ` par ${etat.avis.traitePar}` : ''}.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            {suivant && (
              <Link to={`/erp/reservations/${encodeURIComponent(suivant.reservation.id)}`} className="inline-flex min-h-8 items-center gap-1 text-[13px] font-medium text-(--lm-or-texte) hover:underline">
                Avis suivant : {prenomDe(suivant.reservation.voyageur.nom)} <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            )}
            {modifiable && etat.joursRestants > 0 && (
              <button type="button" onClick={rouvrir} className="inline-flex min-h-8 items-center text-[13px] text-(--lm-encre-2) hover:text-(--lm-encre) hover:underline">
                Annuler
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          {etat.statut === 'a_relire' && (
            <Alert tone="alerte" titre="À relire avant de déposer" className="mb-3">
              <ul>
                {etat.raisons.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </Alert>
          )}
          <Textarea aria-label="Texte de l’avis" rows={4} value={texte} disabled={!modifiable} onChange={(e) => setTexte(e.target.value)} />
          <p className="mt-1.5 text-[12.5px] text-(--lm-encre-3)">
            {etat.joursRestants > 0 ? `Encore ${pluriel(etat.joursRestants, 'jour')} pour le déposer sur Airbnb.` : 'Dernier jour pour le déposer sur Airbnb.'}
            {etat.avis?.source === 'ia' ? ' Texte préparé par votre agent.' : ''}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button icone={<Copy />} onClick={() => void copier()} disabled={!texte.trim()}>
              Copier le texte
            </Button>
            <a href={LIEN_AIRBNB_HOTE} target="_blank" rel="noreferrer noopener" className={classesBouton('secondary', 'md')}>
              <ExternalLink aria-hidden /> Ouvrir Airbnb
            </a>
            <span role="status" className="text-[12.5px] text-(--lm-encre-2)">
              {copie === 'ok' ? 'Copié.' : copie === 'echec' ? 'Copie impossible : sélectionnez le texte.' : ''}
            </span>
          </div>
          {modifiable && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-(--lm-bord) pt-3">
              <Button icone={<Check />} onClick={() => terminer('fait')} disabled={!texte.trim()}>
                C’est fait
              </Button>
              <Button variant="ghost" onClick={() => terminer('passe')}>
                Passer
              </Button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
