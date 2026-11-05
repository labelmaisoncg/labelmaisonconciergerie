/**
 * Demandes des propriétaires, côté gérant (novembre 2026) : la ligne d'une
 * demande (liste de Logements → Demandes, fiche du propriétaire) et son
 * panneau : l'échange en bulles, l'état (Vue, Répondue, Réglée) et la
 * réponse, que le propriétaire lit ensuite dans « Mes demandes ».
 *
 * Ouvrir une demande « Nouvelle » la passe « Vue » ; répondre la passe
 * « Répondue ». Tout passe par le store (collection demandesProprietaires),
 * comme les documents et les bilans de l'espace propriétaire. Réservé au
 * gérant (peutVoirDemandes, peutTraiterDemandes). Règles :
 * data/demandes-proprietaires.ts. Rien ne part vers l'agent IA, le connecteur
 * Claude ou une plateforme.
 */
import { useEffect, useId, useState, type KeyboardEvent } from 'react';
import { Check, ChevronRight } from 'lucide-react';
import {
  LIBELLE_STATUT_GERANT,
  MESSAGE_MAX,
  STATUTS_GERANT,
  changerStatutDemande,
  libelleDemande,
  longueur,
  marquerVue,
  ouPorteLaDemande,
  peutTraiterDemandes,
  repondreDemande,
} from '../../../data/demandes-proprietaires';
import { dateCourte, horodatageMaintenant } from '../../../data/format';
import { logementById } from '../../../data/selectors';
import { nouvelId, useErp } from '../../../data/store';
import type { DemandeProprietaire, StatutDemandeProprietaire } from '../../../data/types';
import { Echanges } from '../../../espace-proprietaire/Demandes';
import { Badge, Button, Drawer, Field, Textarea, cn, type Ton } from '../../../ui';

const NBSP = ' ';

/** Nouvelle : à lire (l'information) ; vue, répondue : neutres ; réglée : le succès. */
export const TON_STATUT_GERANT: Record<StatutDemandeProprietaire, Ton> = { envoyee: 'info', vue: 'neutre', repondue: 'neutre', reglee: 'succes' };

export function BadgeDemande({ statut }: { statut: StatutDemandeProprietaire }) {
  return <Badge tone={TON_STATUT_GERANT[statut]}>{LIBELLE_STATUT_GERANT[statut]}</Badge>;
}

/** Noms utiles d'une demande : propriétaire, logement (« Tous ses logements »). */
export function useNomsDemande() {
  const d = useErp();
  return {
    proprietaire: (x: Pick<DemandeProprietaire, 'proprietaireId'>) => d.proprietaires.find((p) => p.id === x.proprietaireId)?.nom ?? 'Propriétaire',
    ou: (x: Pick<DemandeProprietaire, 'logementId' | 'tousLogements'>) =>
      ouPorteLaDemande({ ...(x.logementId ? { logement: { nom: logementById(d, x.logementId)?.nom ?? 'Logement' } } : {}), tousLogements: x.tousLogements }, 'gerant'),
  };
}

/**
 * Une demande dans une liste : le propriétaire (ou, sur sa fiche, le sujet)
 * en ligne principale ; le sujet, le logement et la date en dessous ; l'état
 * à droite.
 */
export function LigneDemande({ demande: x, onOuvrir, surSaFiche }: { demande: DemandeProprietaire; onOuvrir: () => void; surSaFiche?: boolean }) {
  const noms = useNomsDemande();
  const principal = surSaFiche ? libelleDemande(x) : noms.proprietaire(x);
  const secondaire = [surSaFiche ? '' : libelleDemande(x), noms.ou(x), dateCourte(x.creeLe.slice(0, 10))].filter(Boolean).join(' · ');
  return (
    <button type="button" onClick={onOuvrir} className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left hover:bg-(--lm-surface-2) focus-visible:-outline-offset-2">
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate text-[14.5px] text-(--lm-encre)', x.statut === 'envoyee' ? 'font-semibold' : 'font-medium')}>{principal}</span>
        <span className="block truncate text-[13px] text-(--lm-encre-2)">{secondaire}</span>
      </span>
      <BadgeDemande statut={x.statut} />
      <ChevronRight className="size-4 shrink-0 text-(--lm-encre-3)" aria-hidden />
    </button>
  );
}

type StatutGerant = (typeof STATUTS_GERANT)[number];

/** État de la demande en pilules (choix exclusif, flèches au clavier) ; l'état choisi en or. */
function ChoixEtat({ valeur, onChange, disabled }: { valeur: StatutGerant; onChange: (s: StatutGerant) => void; disabled?: boolean }) {
  const id = useId();
  const clavier = (e: KeyboardEvent<HTMLDivElement>) => {
    const pas = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!pas || disabled) return;
    e.preventDefault();
    const i = STATUTS_GERANT.indexOf(valeur);
    const suivante = STATUTS_GERANT[(i + pas + STATUTS_GERANT.length) % STATUTS_GERANT.length];
    onChange(suivante);
    e.currentTarget.querySelectorAll<HTMLElement>('[role=radio]')[STATUTS_GERANT.indexOf(suivante)]?.focus();
  };
  return (
    <div>
      <p id={id} className="mb-1.5 text-[13px] font-semibold text-(--lm-encre)">
        État
      </p>
      <div role="radiogroup" aria-labelledby={id} onKeyDown={clavier} className="flex flex-wrap gap-1.5">
        {STATUTS_GERANT.map((s) => {
          const actif = s === valeur;
          return (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={actif}
              tabIndex={actif ? 0 : -1}
              disabled={disabled}
              onClick={() => onChange(s)}
              className={cn(
                'inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] whitespace-nowrap transition-colors max-sm:h-11 max-sm:px-4 disabled:cursor-not-allowed disabled:opacity-60',
                actif
                  ? 'border-(--lm-or-texte) bg-(--lm-or-lavis) font-semibold text-(--lm-encre) shadow-[inset_0_0_0_1px_var(--lm-or-texte)]'
                  : 'border-(--lm-bord-fort) bg-(--lm-surface) font-medium text-(--lm-encre) hover:border-(--lm-encre)',
              )}
            >
              {actif && <Check className="size-3.5" aria-hidden />}
              {LIBELLE_STATUT_GERANT[s]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Le panneau d'une demande : l'échange, l'état, la réponse. Ouverte, une
 * demande « Nouvelle » passe « Vue » (gérant, hors lecture seule).
 */
export function DetailDemande({ id, onFermer }: { id: string; onFermer: () => void }) {
  const d = useErp();
  const noms = useNomsDemande();
  const demande = d.donnees.demandesProprietaires.find((x) => x.id === id);
  const peut = peutTraiterDemandes(d.utilisateur.role, d.lectureSeule);
  const [reponse, setReponse] = useState('');
  const [erreur, setErreur] = useState<string>();
  const [envoyee, setEnvoyee] = useState(false);
  const compteurId = useId();

  const statut = demande?.statut;
  useEffect(() => {
    if (!peut || statut !== 'envoyee') return;
    d.mettreAJour('demandesProprietaires', id, (x) => marquerVue(x, { par: d.utilisateur.email, le: horodatageMaintenant() }));
    // Une seule fois par ouverture : l'état change, l'effet ne repasse pas (d change à chaque écriture).
  }, [id, statut, peut]);

  if (!demande) {
    return (
      <Drawer ouvert onFermer={onFermer} titre="Demande introuvable" hauteur="contenu">
        <p className="text-[14px] text-(--lm-encre-2)">Cette demande n’existe plus.</p>
      </Drawer>
    );
  }

  const changer = (s: StatutGerant) => {
    const r = changerStatutDemande(demande, s, { par: d.utilisateur.email, le: horodatageMaintenant() });
    if (r.ok && r.demande !== demande) d.upsert('demandesProprietaires', r.demande);
  };

  const envoyer = () => {
    setErreur(undefined);
    const r = repondreDemande(demande, reponse, { id: nouvelId(`${demande.id}-r`), par: d.utilisateur.email, le: horodatageMaintenant() });
    if (!r.ok) return setErreur(r.erreur);
    d.upsert('demandesProprietaires', r.demande);
    setReponse('');
    setEnvoyee(true);
  };

  const qui = (e: { auteur: 'proprietaire' | 'conciergerie'; id: string }) => {
    if (e.auteur === 'proprietaire') return noms.proprietaire(demande);
    const par = demande.echanges.find((x) => x.id === e.id)?.par;
    if (par && par === d.utilisateur.email) return 'Vous';
    return d.utilisateurs.find((u) => u.email === par)?.nom || 'L’équipe';
  };
  const n = longueur(reponse.trim());

  return (
    <Drawer
      ouvert
      onFermer={onFermer}
      titre={libelleDemande(demande)}
      sousTitre={`${noms.proprietaire(demande)} · ${noms.ou(demande)}`}
      largeur="lg"
      pied={
        peut ? (
          <>
            <Button variant="ghost" onClick={onFermer}>
              Annuler
            </Button>
            <Button variant="primary" onClick={envoyer} disabled={!n || n > MESSAGE_MAX}>
              Envoyer la réponse
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="space-y-6">
        {peut ? (
          <ChoixEtat valeur={demande.statut === 'envoyee' ? 'vue' : demande.statut} onChange={changer} />
        ) : (
          <BadgeDemande statut={demande.statut} />
        )}
        <section aria-label="Échange">
          <Echanges echanges={demande.echanges} moi="conciergerie" nom={qui} />
        </section>
        {peut && (
          <Field label="Votre réponse" aide={`Le propriétaire la lira dans son espace, rubrique «${NBSP}Mes demandes${NBSP}».`} erreur={erreur}>
            <Textarea
              value={reponse}
              rows={4}
              onChange={(e) => {
                setReponse(e.target.value);
                setEnvoyee(false);
                setErreur(undefined);
              }}
              aria-describedby={compteurId}
            />
          </Field>
        )}
        {peut && (
          <div className="-mt-4 flex items-center justify-between gap-3">
            <p role="status" className="inline-flex items-center gap-1 text-[12.5px] font-medium text-(--lm-succes-texte)">
              {envoyee && (
                <>
                  <Check className="size-3.5" aria-hidden />
                  Réponse envoyée
                </>
              )}
            </p>
            <p id={compteurId} className={cn('lm-chiffres text-[12.5px]', n > MESSAGE_MAX ? 'font-semibold text-(--lm-danger)' : 'text-(--lm-encre-3)')}>
              {n.toLocaleString('fr-FR').replace(/ /g, NBSP)} / {MESSAGE_MAX.toLocaleString('fr-FR').replace(/ /g, NBSP)}
            </p>
          </div>
        )}
      </div>
    </Drawer>
  );
}
