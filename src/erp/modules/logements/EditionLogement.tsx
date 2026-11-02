import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Plus, X } from 'lucide-react';
import { Button, Drawer, Field, IconButton, Input, Select, Textarea } from '../../ui';
import { FormProprietaire } from '../proprietaires/FormProprietaire';
import { nouvelId, useErp } from '../../data/store';
import { LIBELLES } from '../../data/libelles';
import { PLAFOND_NUITS_RESIDENCE_PRINCIPALE } from '../../data/constantes';
import { AUJOURDHUI } from '../../data/format';
import { TYPES_LIT, erreursSaisieLogement, logementDepuisSaisie, nomsInterdits, saisieInitiale, type ErreursLogement, type SaisieLogement } from '../../data/creation-logement';
import { enregistrerLogement } from './_composants/enregistrerLogement';
import {
  CHAMPS_MENAGE,
  CHAMPS_TECHNIQUE,
  LIBELLE_ROLE_CONTACT,
  ROLES_CONTACT,
  appliquerTerrain,
  erreursTerrain,
  nouveauContactSaisi,
  saisieTerrainInitiale,
  type SaisieContact,
  type SaisieTerrain,
} from '../../data/terrain';
import type { SectionTerrain } from './onglets/Terrain';
import type { Logement, RoleContact, Serrure, StatutLogement, TypeLogement } from '../../data/types';

interface Props {
  ouvert: boolean;
  onFermer: () => void;
  /** Absent : création d'un nouveau logement (statut « En préparation »). La liste passe par l'assistant pas à pas. */
  logement?: Logement;
  onCree?: (id: string) => void;
  /** Section « Terrain » amenée à l'écran à l'ouverture (« Compléter » de l'onglet Terrain). */
  section?: SectionTerrain;
}

const TYPES = Object.entries(LIBELLES.typeLogement).map(([valeur, libelle]) => ({ valeur, libelle }));
const ROLES = ROLES_CONTACT.map((valeur) => ({ valeur, libelle: LIBELLE_ROLE_CONTACT[valeur] }));
const SERRURES = Object.entries(LIBELLES.serrure).map(([valeur, libelle]) => ({ valeur, libelle }));
const DPES = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((v) => ({ valeur: v, libelle: v }));
/** « En préparation » : pas encore en location (logement créé à la main ou par le dossier propriétaire). */
const STATUTS: { valeur: StatutLogement; libelle: string }[] = [
  { valeur: 'actif', libelle: 'Actif' },
  { valeur: 'pause', libelle: 'En pause' },
  { valeur: 'lancement', libelle: 'En préparation' },
  { valeur: 'sorti', libelle: 'Sorti (plus géré)' },
];

/**
 * Formulaire d'un logement (modification, et création hors liste). Saisie,
 * contrôles et logement enregistré viennent de data/creation-logement.ts,
 * comme pour l'assistant de création : les deux ne peuvent pas diverger.
 */
export function EditionLogement({ ouvert, onFermer, logement, onCree, section }: Props) {
  const d = useErp();
  const { proprietaires } = d;
  const [nouveauProprietaire, setNouveauProprietaire] = useState(false);
  const [s, setS] = useState<SaisieLogement>(() => saisieInitiale(logement));
  const [erreurs, setErreurs] = useState<ErreursLogement>({});
  // Volet terrain (ménage, qui appeler, technique) : à part de la saisie du logement, enregistré avec elle.
  const [t, setT] = useState<SaisieTerrain>(() => saisieTerrainInitiale(logement));
  const [erreursT, setErreursT] = useState<Record<string, string>>({});
  const sections = useRef<Partial<Record<SectionTerrain, HTMLElement | null>>>({});

  useEffect(() => {
    if (ouvert) {
      setS(saisieInitiale(logement));
      setT(saisieTerrainInitiale(logement));
      setErreurs({});
      setErreursT({});
    }
  }, [ouvert, logement]);

  // « Compléter » depuis l'onglet Terrain : la section demandée arrive en haut du panneau.
  useEffect(() => {
    if (!ouvert || !section) return;
    const id = requestAnimationFrame(() => sections.current[section]?.scrollIntoView({ block: 'start' }));
    return () => cancelAnimationFrame(id);
  }, [ouvert, section]);

  const maj = <K extends keyof SaisieLogement>(k: K, v: SaisieLogement[K]) => setS((x) => ({ ...x, [k]: v }));
  const majMenage = (k: keyof SaisieTerrain['menage'], v: string) => setT((x) => ({ ...x, menage: { ...x.menage, [k]: v } }));
  const majTechnique = (k: keyof SaisieTerrain['technique'], v: string) => setT((x) => ({ ...x, technique: { ...x.technique, [k]: v } }));
  const majContact = (cle: string, patch: Partial<SaisieContact>) => setT((x) => ({ ...x, contacts: x.contacts.map((c) => (c.cle === cle ? { ...c, ...patch } : c)) }));
  const retirerContact = (cle: string) => setT((x) => ({ ...x, contacts: x.contacts.filter((c) => c.cle !== cle) }));
  const ajouterContact = () => setT((x) => ({ ...x, contacts: [...x.contacts, nouveauContactSaisi()] }));

  const enregistrer = (ev: FormEvent) => {
    ev.preventDefault();
    // Pas deux logements du même nom (sans casse, accents ni espaces) ; garder le sien reste possible.
    const e = erreursSaisieLogement(s, { nomsPris: nomsInterdits(d.logements, logement, s.nom) });
    const eT = logement ? erreursTerrain(t).contacts : {};
    setErreurs(e);
    setErreursT(eT);
    if (Object.keys(e).length || Object.keys(eT).length) return;
    const saisi = logementDepuisSaisie(s, logement ?? nouvelId('log'), AUJOURDHUI);
    const aEnregistrer = logement ? appliquerTerrain(saisi, t) : saisi;
    enregistrerLogement(d, aEnregistrer);
    onFermer();
    if (!logement) onCree?.(aEnregistrer.id);
  };

  return (
    <>
    <Drawer
      ouvert={ouvert}
      onFermer={onFermer}
      titre={logement ? `Modifier ${logement.nom}` : 'Nouveau logement'}
      sousTitre={logement ? undefined : 'Il démarre « En préparation ».'}
      pied={
        <>
          <Button onClick={onFermer}>Annuler</Button>
          <Button variant="primary" type="submit" form="form-logement">
            {logement ? 'Enregistrer' : 'Créer le logement'}
          </Button>
        </>
      }
    >
      <form id="form-logement" onSubmit={enregistrer} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {logement && (
          <Field label="Statut" className="sm:col-span-2">
            <Select value={s.statut} onChange={(e) => maj('statut', e.target.value as StatutLogement)} options={STATUTS} />
          </Field>
        )}
        <Field label="Nom du logement" requis erreur={erreurs.nom} className="sm:col-span-2">
          <Input value={s.nom} onChange={(e) => maj('nom', e.target.value)} placeholder="Ex. Corbeil Rives de Seine" />
        </Field>
        <Field label="Propriétaire" requis erreur={erreurs.proprietaireId} className="sm:col-span-2">
          <Select
            value={s.proprietaireId}
            onChange={(e) => maj('proprietaireId', e.target.value)}
            placeholder={proprietaires.length ? 'Choisir un propriétaire' : 'Aucun propriétaire : ajoutez-le'}
            options={proprietaires.map((p) => ({ valeur: p.id, libelle: p.nom }))}
          />
        </Field>
        <button
          type="button"
          onClick={() => setNouveauProprietaire(true)}
          className="-mt-2 inline-flex h-8 items-center gap-1 justify-self-start text-[13px] font-medium lm-lien sm:col-span-2"
        >
          <Plus className="size-3.5" aria-hidden />
          Nouveau propriétaire
        </button>
        <Field label="Adresse" requis erreur={erreurs.adresse} className="sm:col-span-2">
          <Input value={s.adresse} onChange={(e) => maj('adresse', e.target.value)} autoComplete="street-address" />
        </Field>
        <Field label="Code postal" requis erreur={erreurs.codePostal}>
          <Input value={s.codePostal} onChange={(e) => maj('codePostal', e.target.value)} inputMode="numeric" maxLength={5} />
        </Field>
        <Field label="Ville" requis erreur={erreurs.ville}>
          <Input value={s.ville} onChange={(e) => maj('ville', e.target.value)} />
        </Field>
        <Field label="Type">
          <Select value={s.type} onChange={(e) => maj('type', e.target.value as TypeLogement)} options={TYPES} />
        </Field>
        <Field label="Surface (m²)" erreur={erreurs.surfaceM2}>
          <Input value={s.surfaceM2} onChange={(e) => maj('surfaceM2', e.target.value)} inputMode="numeric" />
        </Field>
        <Field label="Capacité (voyageurs)" requis erreur={erreurs.capacite}>
          <Input value={s.capacite} onChange={(e) => maj('capacite', e.target.value)} inputMode="numeric" />
        </Field>
        <Field label="Chambres" erreur={erreurs.chambres}>
          <Input value={s.chambres} onChange={(e) => maj('chambres', e.target.value)} inputMode="numeric" />
        </Field>
        <fieldset className="sm:col-span-2">
          <legend className="mb-1.5 text-[13px] font-medium text-(--lm-encre)">Lits</legend>
          <div className="grid grid-cols-3 gap-3">
            {TYPES_LIT.map((t) => (
              <Field key={t} label={LIBELLES.typeLit[t]}>
                <Input value={s.lits[t]} onChange={(e) => maj('lits', { ...s.lits, [t]: e.target.value })} inputMode="numeric" />
              </Field>
            ))}
          </div>
          {erreurs.lits && <p role="alert" className="mt-1 text-[12px] font-medium text-(--lm-danger)">{erreurs.lits}</p>}
        </fieldset>
        <Field label="DPE">
          <Select value={s.dpe} onChange={(e) => maj('dpe', e.target.value)} placeholder="Non fourni" options={DPES} />
        </Field>
        <Field label="Serrure / accès">
          <Select value={s.serrure} onChange={(e) => maj('serrure', e.target.value as Serrure)} options={SERRURES} />
        </Field>
        <Field label="N° d’enregistrement meublé de tourisme" erreur={erreurs.numeroEnregistrement} className="sm:col-span-2">
          <Input value={s.numeroEnregistrement} onChange={(e) => maj('numeroEnregistrement', e.target.value)} placeholder="91174000125RX" />
        </Field>
        <label className="flex items-start gap-2.5 text-[13.5px] sm:col-span-2">
          <input
            type="checkbox"
            checked={s.residencePrincipale}
            onChange={(e) => maj('residencePrincipale', e.target.checked)}
            className="mt-0.5 size-4 accent-(--lm-or)"
          />
          <span>
            Résidence principale du propriétaire
            <span className="block text-[12px] text-(--lm-encre-3)">Location limitée à {PLAFOND_NUITS_RESIDENCE_PRINCIPALE} nuits par année civile.</span>
          </span>
        </label>

        {/* Terrain (modification seulement) : ce que l'équipe doit savoir sur place, jamais transmis aux voyageurs. */}
        {logement && (
          <>
            <div className="mt-2 border-t border-(--lm-bord) pt-5 sm:col-span-2">
              <h3 className="text-[15px] leading-snug font-semibold text-(--lm-encre)">Terrain</h3>
              <p className="mt-0.5 text-[13px] text-(--lm-encre-2)">{'Pour l’équipe seulement : rien d’ici n’est transmis aux voyageurs, à votre agent ni au propriétaire.'}</p>
            </div>

            <fieldset
              ref={(el) => {
                sections.current.menage = el;
              }}
              className="scroll-mt-4 sm:col-span-2"
            >
              <legend className="mb-2 text-[14px] font-semibold text-(--lm-encre)">Ménage</legend>
              <div className="grid grid-cols-1 gap-4">
                {CHAMPS_MENAGE.map((c) => (
                  <Field key={c.cle} label={c.libelle} aide={c.cle === 'consignes' ? c.aide : undefined}>
                    {c.cle === 'duree' ? (
                      <Input value={t.menage[c.cle]} onChange={(e) => majMenage(c.cle, e.target.value)} placeholder={c.aide} />
                    ) : (
                      <Textarea
                        value={t.menage[c.cle]}
                        onChange={(e) => majMenage(c.cle, e.target.value)}
                        rows={c.cle === 'produits' ? 2 : 3}
                        placeholder={c.cle === 'produits' ? c.aide : undefined}
                      />
                    )}
                  </Field>
                ))}
              </div>
            </fieldset>

            <fieldset
              ref={(el) => {
                sections.current.contacts = el;
              }}
              className="scroll-mt-4 sm:col-span-2"
            >
              <legend className="mb-2 text-[14px] font-semibold text-(--lm-encre)">Qui appeler</legend>
              {t.contacts.length === 0 && <p className="mb-2 text-[13px] text-(--lm-encre-2)">Ménage, serrurier, urgence… les numéros à avoir sous la main.</p>}
              <ul className="flex flex-col gap-3">
                {t.contacts.map((c, i) => (
                  <li key={c.cle} className="rounded-xl border border-(--lm-bord) p-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Field label="Rôle">
                        <Select value={c.role} onChange={(e) => majContact(c.cle, { role: e.target.value as RoleContact })} options={ROLES} />
                      </Field>
                      <Field label="Nom" erreur={erreursT[c.cle]}>
                        <Input value={c.nom} onChange={(e) => majContact(c.cle, { nom: e.target.value })} placeholder="Ex. Nadia, ménage" />
                      </Field>
                      <Field label="Téléphone">
                        <Input type="tel" inputMode="tel" autoComplete="off" value={c.telephone} onChange={(e) => majContact(c.cle, { telephone: e.target.value })} placeholder="06 00 00 00 00" />
                      </Field>
                      <Field label="Note">
                        <Input value={c.note} onChange={(e) => majContact(c.cle, { note: e.target.value })} placeholder="Ex. prévenir la veille" />
                      </Field>
                    </div>
                    <div className="mt-2 flex justify-end">
                      <IconButton label={`Retirer le contact ${c.nom.trim() || i + 1}`} size="sm" onClick={() => retirerContact(c.cle)}>
                        <X />
                      </IconButton>
                    </div>
                  </li>
                ))}
              </ul>
              <Button size="sm" icone={<Plus />} onClick={ajouterContact} className={t.contacts.length ? 'mt-3' : ''}>
                Ajouter un contact
              </Button>
            </fieldset>

            <fieldset
              ref={(el) => {
                sections.current.technique = el;
              }}
              className="scroll-mt-4 sm:col-span-2"
            >
              <legend className="mb-2 text-[14px] font-semibold text-(--lm-encre)">Technique</legend>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {CHAMPS_TECHNIQUE.map((c) => (
                  <Field key={c.cle} label={c.libelle}>
                    <Input value={t.technique[c.cle]} onChange={(e) => majTechnique(c.cle, e.target.value)} />
                  </Field>
                ))}
                <Field label="Notes" className="sm:col-span-2">
                  <Textarea value={t.technique.notes} onChange={(e) => majTechnique('notes', e.target.value)} rows={3} placeholder="Ce qu’il faut savoir d’autre sur place." />
                </Field>
              </div>
            </fieldset>
          </>
        )}
      </form>
    </Drawer>
    {/* Hors du panneau : une fenêtre par-dessus, pas dedans. */}
    <FormProprietaire ouvert={nouveauProprietaire} onFermer={() => setNouveauProprietaire(false)} onCree={(id) => maj('proprietaireId', id)} />
    </>
  );
}
