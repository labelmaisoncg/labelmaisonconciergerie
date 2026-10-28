/**
 * « Livret et check-in » d'un séjour, dans la fiche de la réservation : où
 * en est le check-in en ligne (fait / pas encore), ce que le voyageur a
 * envoyé (heure d'arrivée, voyageurs, fiches de police), et « Copier le
 * lien » du livret. Le lien est signé par le serveur (api/sejour.ts, action
 * « equipe », gérant ou opérations de l'espace) ; le check-in n'est jamais
 * chargé avec le reste de l'ERP : il est lu ici, pour ce séjour seulement.
 * Démo : lien et check-in de ce navigateur (sejour/demo.ts).
 */
import { useEffect, useState } from 'react';
import { Check, Copy, Lock } from 'lucide-react';
import { Alert, Badge, Button, Card, CardHeader } from '../../../ui';
import { useErp } from '../../../data/store';
import { AUJOURDHUI, dateCourte, jourMois, pluriel } from '../../../data/format';
import { etatLienSejour, lienValableJusquAu, type CheckinEnLigne, type SuiviSejour } from '../../../data/sejour';
import type { Reservation } from '../../../data/types';
import { checkinsDemo, lienSejourDemo } from '../../../sejour/demo';
import { ErreurServeur, appelerServeur } from '../../messagerie/_composants/serveur';

type Etat = { nom: 'chargement' } | { nom: 'cache' } | { nom: 'erreur'; message: string } | { nom: 'pret'; suivi: SuiviSejour };

const dateNaissance = (d: string) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : d);

function Fiches({ c }: { c: CheckinEnLigne }) {
  if (c.tousFrancais) return <p className="text-[13px] text-(--lm-encre-2)">Tous de nationalité française : pas de fiche de police.</p>;
  return (
    <details className="text-[13px]">
      <summary className="inline-flex h-8 cursor-pointer list-none items-center gap-1.5 font-medium text-(--lm-or-texte) hover:underline [&::-webkit-details-marker]:hidden">
        <Lock className="size-3.5" aria-hidden />
        {pluriel(c.fiches.length, 'fiche de police', 'fiches de police')}
      </summary>
      <ul className="mt-1 flex flex-col gap-2">
        {c.fiches.map((f, i) => (
          <li key={i} className="rounded-lg bg-(--lm-surface-2) px-3 py-2 text-(--lm-encre-2)">
            <p className="font-medium text-(--lm-encre)">
              {f.nom.toUpperCase()} {f.prenoms}
            </p>
            <p>
              Né(e) le {dateNaissance(f.naissanceLe)} à {f.naissanceLieu} · {f.nationalite}
            </p>
            <p>{f.domicile}</p>
            {f.enfants > 0 && <p>{pluriel(f.enfants, 'enfant de moins de 15 ans', 'enfants de moins de 15 ans')} sur sa fiche</p>}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[12px] text-(--lm-encre-3)">
        Gardées jusqu’au {dateCourte(c.conserverJusquAu)}, puis effacées automatiquement. À remettre seulement à la police ou à la gendarmerie, sur leur demande.
      </p>
    </details>
  );
}

export function CarteSejourEnLigne({ r }: { r: Reservation }) {
  const d = useErp();
  const demo = d.mode === 'demo';
  const [etat, setEtat] = useState<Etat>({ nom: 'chargement' });
  const [copie, setCopie] = useState<'ok' | 'echec' | null>(null);

  useEffect(() => {
    let actif = true;
    setCopie(null);
    if (demo) {
      const e = etatLienSejour(r, AUJOURDHUI);
      const checkin = checkinsDemo()[r.id];
      setEtat({ nom: 'pret', suivi: { etat: e, ...(checkin ? { checkin } : {}), ...(e === 'ouvert' ? { lien: lienSejourDemo(r.id), lienJusquAu: lienValableJusquAu(r.depart) } : {}) } });
      return;
    }
    setEtat({ nom: 'chargement' });
    appelerServeur<{ suivi: SuiviSejour }>(`/api/sejour?action=equipe&reservationId=${encodeURIComponent(r.id)}`, 'GET').then(
      (x) => actif && setEtat({ nom: 'pret', suivi: x.suivi }),
      // Compte qui n'y a pas droit (lecture) : la carte ne s'affiche pas.
      (e: unknown) => actif && setEtat(e instanceof ErreurServeur && e.statut === 403 ? { nom: 'cache' } : { nom: 'erreur', message: e instanceof Error ? e.message : 'Livret indisponible pour le moment.' }),
    );
    return () => {
      actif = false;
    };
    // Relu quand le séjour change (dates, statut) : le lien et son échéance suivent.
  }, [demo, r]);

  if (etat.nom === 'chargement' || etat.nom === 'cache') return null;
  if (etat.nom === 'erreur') {
    return (
      <Card>
        <CardHeader titre="Livret et check-in en ligne" />
        <p className="text-[13px] text-(--lm-encre-2)">{etat.message}</p>
      </Card>
    );
  }
  const { suivi } = etat;
  const c = suivi.checkin;

  const copier = async () => {
    if (!suivi.lien) return;
    try {
      await navigator.clipboard.writeText(suivi.lien);
      setCopie('ok');
    } catch {
      setCopie('echec');
    }
  };

  return (
    <Card>
      <CardHeader
        titre="Livret et check-in en ligne"
        actions={
          suivi.lien && (
            <Button size="sm" variant="secondary" icone={copie === 'ok' ? <Check /> : <Copy />} onClick={() => void copier()}>
              {copie === 'ok' ? 'Lien copié' : 'Copier le lien'}
            </Button>
          )
        }
      />
      <p className="flex flex-wrap items-center gap-2 text-[13.5px] text-(--lm-encre-2)">
        Check-in en ligne :
        {c ? <Badge tone="succes">Fait</Badge> : <Badge tone="neutre">Pas encore</Badge>}
        {c && <span className="text-[12.5px] text-(--lm-encre-3)">le {jourMois(c.envoyeLe.slice(0, 10))}</span>}
      </p>
      {c && (
        <div className="mt-3 flex flex-col gap-2 border-t border-(--lm-bord) pt-3">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13.5px]">
            <div>
              <dt className="text-[12px] text-(--lm-encre-3)">Arrivée prévue</dt>
              <dd className="lm-chiffres font-medium text-(--lm-encre)">vers {c.arriveeEstimee}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-(--lm-encre-3)">Voyageurs</dt>
              <dd className="lm-chiffres font-medium text-(--lm-encre)">{pluriel(c.nbPersonnes, 'personne')}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-[12px] text-(--lm-encre-3)">Règlement intérieur</dt>
              <dd className="font-medium text-(--lm-encre)">Accepté</dd>
            </div>
          </dl>
          <Fiches c={c} />
        </div>
      )}
      {suivi.etat === 'annule' && <p className="mt-2 text-[12.5px] text-(--lm-encre-3)">Réservation annulée : le lien n’affiche plus rien.</p>}
      {suivi.etat === 'expire' && <p className="mt-2 text-[12.5px] text-(--lm-encre-3)">Lien expiré (quelques jours après le départ).</p>}
      {suivi.lien && suivi.lienJusquAu && (
        <p className="mt-2 text-[12.5px] text-(--lm-encre-3)">
          Codes visibles seulement 48 h avant l’arrivée. Lien valable jusqu’au {dateCourte(suivi.lienJusquAu)}.
        </p>
      )}
      {suivi.raison && (
        <Alert tone="alerte" className="mt-3">
          {suivi.raison}
        </Alert>
      )}
      {copie === 'echec' && (
        <Alert tone="alerte" className="mt-3">
          Copie impossible dans ce navigateur : {suivi.lien}
        </Alert>
      )}
    </Card>
  );
}
