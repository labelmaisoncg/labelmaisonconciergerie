/**
 * Incidents du logement, sur sa fiche : ce que l'équipe de terrain a signalé
 * depuis l'espace opérations (ou noté ici). Mêmes mots que l'espace
 * opérations ; seul « Urgent » est en rouge. Le gérant peut s'en occuper, le
 * marquer réglé ou ajouter un mot ; les autres le lisent.
 * Arrivée par une notification ou l'accueil (`?incident=<id>`) : la ligne est
 * amenée à l'écran et soulignée un instant.
 */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ajouterMot, incidentsDuLogement, marquerRegle, prendreEnCharge } from '../../../data/incidents-erp';
import { LIBELLES } from '../../../data/libelles';
import { estUrgent } from '../../../data/operations';
import { useErp } from '../../../data/store';
import { horodatageMaintenant, jourMois } from '../../../data/format';
import type { Incident, Logement } from '../../../data/types';
import { Badge, Button, Card, CardHeader, Textarea, cn } from '../../../ui';

function Ligne({ i, peutAgir, enVue }: { i: Incident; peutAgir: boolean; enVue: boolean }) {
  const d = useErp();
  const [mot, setMot] = useState<string | null>(null);
  const membre = (id?: string) => (id ? d.equipe?.find((m) => m.id === id)?.nom : undefined);
  const signalePar = membre(i.signalePar);
  const confieA = membre(i.assigneA) ?? i.responsable;
  const dernier = i.historique?.at(-1);
  const par = d.utilisateur.nom;
  const agir = (patch: (x: Incident) => Incident) => d.mettreAJour('incidents', i.id, patch);
  const regle = i.statut === 'resolu';

  return (
    <li id={`incident-${i.id}`} className={cn('scroll-mt-24 px-4 py-3 transition-colors duration-700 sm:px-5', enVue && 'bg-(--lm-or-lavis)')}>
      <div className="flex flex-wrap items-center gap-2">
        {estUrgent(i) && !regle && <Badge tone="danger">Urgent</Badge>}
        <Badge tone={regle ? 'succes' : 'neutre'}>{LIBELLES.statutIncident[i.statut]}</Badge>
        <span className="text-[12px] text-(--lm-encre-2)">{LIBELLES.categorieIncident[i.categorie] ?? 'Incident'}</span>
      </div>
      <p className="mt-1.5 text-[13.5px] whitespace-pre-line text-(--lm-encre)">{i.description}</p>
      <p className="mt-1 text-[12.5px] text-(--lm-encre-2)">
        {[
          signalePar ? `Signalé par ${signalePar} le ${jourMois(i.date)}` : `Noté le ${jourMois(i.date)}`,
          regle ? (i.resoluLe ? `réglé le ${jourMois(i.resoluLe)}` : undefined) : confieA ? `confié à ${confieA}` : 'personne dessus pour l’instant',
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
      {dernier && (
        <p className="mt-1 text-[12.5px] text-(--lm-encre-2)">
          Dernier mot de {dernier.par}, le {jourMois(dernier.le.slice(0, 10))} : « {dernier.texte} »
        </p>
      )}

      {peutAgir && !regle && mot === null && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {i.statut === 'ouvert' && (
            <Button size="sm" variant="secondary" onClick={() => agir((x) => prendreEnCharge(x, par, horodatageMaintenant()))}>
              Je m’en occupe
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={() => agir((x) => marquerRegle(x, par, horodatageMaintenant()))}>
            Marquer réglé
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setMot('')}>
            Ajouter un mot
          </Button>
        </div>
      )}
      {peutAgir && mot !== null && (
        <div className="mt-2 rounded-xl border border-(--lm-bord) bg-(--lm-surface-2) p-3">
          <Textarea rows={2} value={mot} autoFocus aria-label="Votre mot" maxLength={1000} onChange={(e) => setMot(e.target.value)} placeholder="Ce qui a été fait, ce qu’il reste à faire." />
          <div className="mt-2 flex flex-wrap justify-end gap-1.5">
            <Button size="sm" variant="ghost" onClick={() => setMot(null)}>
              Annuler
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={!mot.trim()}
              onClick={() => {
                const texte = mot;
                agir((x) => ajouterMot(x, par, horodatageMaintenant(), texte));
                setMot(null);
              }}
            >
              Ajouter
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}

export function IncidentsLogement({ logement: l }: { logement: Logement }) {
  const d = useErp();
  const [params] = useSearchParams();
  const cible = params.get('incident');
  const { ouverts, regles } = incidentsDuLogement(d, l.id);
  const [voirRegles, setVoirRegles] = useState(false);
  const [enVue, setEnVue] = useState<string | null>(null);
  const peutAgir = d.utilisateur.role === 'gerant' && !d.lectureSeule;

  // Arrivée par un lien vers un incident : l'amener à l'écran et le souligner un instant.
  useEffect(() => {
    if (!cible) return;
    if (regles.some((i) => i.id === cible)) setVoirRegles(true);
    const t = window.setTimeout(() => {
      const el = document.getElementById(`incident-${cible}`);
      if (!el) return;
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      setEnVue(cible);
    }, 150);
    const fin = window.setTimeout(() => setEnVue(null), 2800);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(fin);
    };
    // Une fois par lien suivi : la liste peut changer sans relancer l'effet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cible]);

  if (!ouverts.length && !regles.length) return null;
  const affiches = voirRegles ? [...ouverts, ...regles.slice(0, 10)] : ouverts;

  return (
    <Card flush className="overflow-hidden">
      <div className="p-4 pb-0 sm:p-5 sm:pb-0">
        <CardHeader
          titre={ouverts.length ? `Incidents ouverts (${ouverts.length})` : 'Incidents ouverts'}
          actions={
            regles.length > 0 && (
              <button type="button" onClick={() => setVoirRegles((v) => !v)} aria-expanded={voirRegles} className="inline-flex min-h-8 items-center text-[13px] font-medium text-(--lm-or-texte) hover:underline">
                {voirRegles ? 'Masquer les réglés' : `Voir les réglés (${regles.length})`}
              </button>
            )
          }
        />
      </div>
      {affiches.length ? (
        <ul className="divide-y divide-(--lm-bord) border-t border-(--lm-bord)">
          {affiches.map((i) => (
            <Ligne key={i.id} i={i} peutAgir={peutAgir} enVue={enVue === i.id} />
          ))}
        </ul>
      ) : (
        <p className="border-t border-(--lm-bord) px-4 py-3 text-[13.5px] text-(--lm-encre-2) sm:px-5">Aucun incident ouvert.</p>
      )}
    </Card>
  );
}
