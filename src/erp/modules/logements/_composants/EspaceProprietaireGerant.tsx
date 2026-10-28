/**
 * Espace propriétaire, côté gérant (carte « Propriétaire » de la fiche
 * logement) : inviter ou retirer l'accès, partager des documents, préparer
 * puis publier les bilans mensuels, et voir l'espace tel que le propriétaire
 * le voit. Les accès sont écrits par le serveur (api/espace-proprietaire.ts) ;
 * documents et bilans passent par le store comme le reste de l'ERP.
 */
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Check, Copy, Eye, FileText, Trash2, X } from 'lucide-react';
import { statutAccesExterne } from '../../../data/acces-gerant';
import { MODE_DEMO } from '../../../data/config';
import { espaceOuvert } from '../../../data/espaces';
import { AUJOURDHUI, dateCourte, euros, horodatageMaintenant } from '../../../data/format';
import { facturePartagee } from '../../../data/relances';
import { nouvelId, useErp } from '../../../data/store';
import {
  CATEGORIES_DOCUMENT,
  CONTENU_ESPACE,
  LIBELLE_CATEGORIE,
  bilanMensuel,
  etatBilan,
  memesChiffres,
  moisTermines,
  vueProprietaire,
} from '../../../data/proprietaire';
import type { Logement, Proprietaire } from '../../../data/types';
import type { AccesProprietaire, BilanProprietaire, CategorieDocumentProprietaire } from '../../../data/types-proprietaire';
import { BilanDetail } from '../../../espace-proprietaire/Bilans';
import { EspaceVue } from '../../../espace-proprietaire/EspaceVue';
import { bilanDuMois, deNom, titreMois, type LienDocumentProps, type OngletEspace } from '../../../espace-proprietaire/commun';
import { Alert, Badge, Button, Drawer, EnvoiFichier, Field, IconButton, Input, LienFichier, Modal, Select, Textarea, useFenetre } from '../../../ui';
import { appelerServeur, ErreurServeur } from '../../messagerie/_composants/serveur';
import { FacturesProprietaire } from './FacturesProprietaire';
import { RelancesPaiement } from './RelancesPaiement';

interface EtatServeur {
  actif: boolean;
  email: boolean;
  raison?: string;
}

const API = '/api/espace-proprietaire';

/**
 * Invitation envoyée par le serveur. La fiche (nouvelle, ou dont l'adresse
 * vient de changer) peut mettre un instant à arriver en base : on réessaie
 * tant que le serveur ne la voit pas encore (404) ou pas encore à jour (409).
 */
export async function inviterAvecReessai(api: string, corps: Record<string, unknown>): Promise<{ lien: string; envoye: boolean }> {
  let derniere: unknown;
  for (const attente of [0, 1500, 3000, 6000]) {
    if (attente) await new Promise((r) => setTimeout(r, attente));
    try {
      return await appelerServeur<{ lien: string; envoye: boolean }>(api, 'POST', corps);
    } catch (e) {
      derniere = e;
      if (!(e instanceof ErreurServeur) || !(e.statut === 404 || (e.statut === 409 && e.code === 'fiche'))) throw e;
    }
  }
  throw derniere;
}

/** Ce que voit un propriétaire (même phrase ici et dans Paramètres → Accès). */
export const CE_QUE_VOIT_LE_PROPRIETAIRE = `Il voit ${CONTENU_ESPACE.lui}, sans rien pouvoir modifier.`;

/**
 * État de l'accès en une ligne (« Connecté le 21 sept. 2026 »), aussi pour
 * Paramètres → Accès ; « Adresse changée : réinvitez » si l'adresse de la
 * fiche n'est plus celle de l'invitation.
 */
export function statutAcces(a: AccesProprietaire | undefined, p: Pick<Proprietaire, 'contact'>): { texte: string; ton: 'neutre' | 'succes' | 'alerte' } {
  return statutAccesExterne(a, p.contact?.email);
}

/** Ligne de la carte Propriétaire : état de l'accès et ouverture du panneau. */
export function CarteEspaceProprietaire({ proprietaire, logement }: { proprietaire: Proprietaire; logement: Logement }) {
  const d = useErp();
  const { hash } = useLocation();
  const [ouvert, setOuvert] = useState(false);
  // Ouvert depuis « facture mensuelle à valider » (Accueil, lien « #factures ») : la carte vient à l'écran, les factures s'ouvrent.
  useEffect(() => {
    if (hash !== '#factures') return;
    document.getElementById('factures')?.scrollIntoView({ block: 'start' });
    setOuvert(true);
  }, [hash]);
  const acces = d.donnees.accesProprietaires.find((a) => a.id === proprietaire.id);
  const s = statutAcces(acces, proprietaire);
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-(--lm-bord) pt-3">
      <div className="min-w-0">
        <p className="text-[13.5px] font-medium text-(--lm-encre)">Espace propriétaire</p>
        <p className="text-[12.5px] text-(--lm-encre-2)">{s.texte}</p>
      </div>
      <Button variant="secondary" size="sm" onClick={() => setOuvert(true)}>
        Gérer
      </Button>
      {ouvert && <PanneauEspace proprietaire={proprietaire} logement={logement} section={hash === '#factures' ? 'factures' : undefined} onFermer={() => setOuvert(false)} />}
    </div>
  );
}

/** Le panneau complet (accès, bilans, documents) ; ouvert aussi depuis Paramètres → Accès, sans logement. */
export function PanneauEspace({
  proprietaire: p,
  logement,
  section,
  onFermer,
}: {
  proprietaire: Proprietaire;
  logement?: Logement;
  /** Partie du panneau à montrer à l'ouverture (« factures » : les factures, brouillons à valider en tête). */
  section?: 'factures';
  onFermer: () => void;
}) {
  const [apercu, setApercu] = useState(false);
  useEffect(() => {
    if (section !== 'factures') return;
    // Après l'ouverture du panneau (rendu au cadre suivant).
    const cadre = window.requestAnimationFrame(() => document.getElementById('factures-proprietaire')?.scrollIntoView({ block: 'start' }));
    return () => window.cancelAnimationFrame(cadre);
  }, [section]);
  const [serveur, setServeur] = useState<EtatServeur | null>(MODE_DEMO ? { actif: true, email: false } : null);
  useEffect(() => {
    if (MODE_DEMO) return;
    let actif = true;
    appelerServeur<EtatServeur>(`${API}?action=etat`, 'GET')
      .then((r) => actif && setServeur({ actif: r.actif, email: r.email, raison: r.raison }))
      .catch((e: Error) => actif && setServeur({ actif: false, email: false, raison: e.message }));
    return () => {
      actif = false;
    };
  }, []);

  return (
    <>
      <Drawer
        ouvert={!apercu}
        onFermer={onFermer}
        titre="Espace propriétaire"
        sousTitre={p.nom}
        largeur="lg"
        pied={
          <Button variant="secondary" icone={<Eye />} onClick={() => setApercu(true)}>
            Voir son espace
          </Button>
        }
      >
        <div className="space-y-7">
          <Acces proprietaire={p} serveur={serveur} />
          <Bilans proprietaire={p} />
          <div id="factures-proprietaire" className="scroll-mt-4">
            <FacturesProprietaire proprietaire={p} />
          </div>
          <RelancesPaiement proprietaireId={p.id} />
          <Documents proprietaire={p} logement={logement} />
        </div>
      </Drawer>
      {apercu && <ApercuEspace proprietaire={p} onFermer={() => setApercu(false)} />}
    </>
  );
}

function Titre({ children, description }: { children: string; description?: string }) {
  return (
    <div className="mb-3">
      <h3 className="text-[15px] font-semibold text-(--lm-encre)">{children}</h3>
      {description && <p className="text-[13px] text-(--lm-encre-2)">{description}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ accès */

function Acces({ proprietaire: p, serveur }: { proprietaire: Proprietaire; serveur: EtatServeur | null }) {
  const d = useErp();
  const acces = d.donnees.accesProprietaires.find((a) => a.id === p.id);
  // L'adresse de la fiche, toujours (une autre adresse saisie ici devient celle de la fiche).
  const [email, setEmail] = useState(p.contact.email ?? '');
  const [enCours, setEnCours] = useState<'inviter' | 'retirer'>();
  const [erreur, setErreur] = useState<string>();
  const [invitation, setInvitation] = useState<{ lien: string; envoye: boolean }>();
  const [confirmer, setConfirmer] = useState(false);
  const [copie, setCopie] = useState(false);
  const s = statutAcces(acces, p);
  const ferme = !serveur?.actif;

  const inviter = async () => {
    setErreur(undefined);
    setInvitation(undefined);
    const adresse = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(adresse)) return setErreur('Adresse e-mail invalide.');
    // Une autre adresse : c'est désormais celle de la fiche (le serveur n'invite que l'adresse de la fiche).
    if (adresse !== (p.contact.email ?? '').trim().toLowerCase()) d.mettreAJour('proprietaires', p.id, (x) => ({ ...x, contact: { ...x.contact, email: adresse } }));
    if (MODE_DEMO) {
      // Mêmes règles que le serveur : autre adresse, sessions fermées (version) et liens oubliés.
      const autre = !!acces && acces.email !== adresse;
      d.upsert('accesProprietaires', {
        id: p.id,
        proprietaireId: p.id,
        email: adresse,
        emailFiche: adresse,
        statut: acces?.statut === 'actif' && !autre ? 'actif' : 'invite',
        inviteLe: horodatageMaintenant(),
        invitePar: d.utilisateur.email,
        version: (acces?.version ?? 1) + (autre && acces?.statut === 'actif' ? 1 : 0),
        liens: [],
        ...(acces?.derniereConnexion && !autre ? { derniereConnexion: acces.derniereConnexion } : {}),
      });
      setInvitation({ lien: `${window.location.origin}/espace-proprietaire?apercu=${encodeURIComponent(p.id)}`, envoye: false });
      return;
    }
    setEnCours('inviter');
    try {
      const r = await inviterAvecReessai(API, { action: 'inviter', proprietaireId: p.id, email: adresse });
      setInvitation({ lien: r.lien, envoye: r.envoye });
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setEnCours(undefined);
    }
  };

  const retirer = async () => {
    setErreur(undefined);
    setConfirmer(false);
    setInvitation(undefined);
    if (MODE_DEMO) {
      if (acces) d.upsert('accesProprietaires', { ...acces, statut: 'retire', retireLe: horodatageMaintenant(), version: acces.version + 1, liens: [] });
      return;
    }
    setEnCours('retirer');
    try {
      await appelerServeur(API, 'POST', { action: 'retirer', proprietaireId: p.id });
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setEnCours(undefined);
    }
  };

  const copier = async () => {
    if (!invitation) return;
    try {
      await navigator.clipboard.writeText(invitation.lien);
      setCopie(true);
      window.setTimeout(() => setCopie(false), 2000);
    } catch {
      /* copie refusée : le lien reste sélectionnable */
    }
  };

  return (
    <section>
      <Titre description={CE_QUE_VOIT_LE_PROPRIETAIRE}>Accès</Titre>
      {serveur && !serveur.actif && (
        <Alert tone="alerte" className="mb-3">
          {serveur.raison ?? 'L’espace propriétaire n’est pas encore ouvert sur le serveur.'}
        </Alert>
      )}
      <div className="mb-3 flex items-center gap-2">
        <Badge tone={s.ton} point>
          {s.texte}
        </Badge>
        {acces && acces.statut !== 'retire' && <span className="truncate text-[12.5px] text-(--lm-encre-2)">{acces.email}</span>}
      </div>
      <Field
        label="Adresse e-mail du propriétaire"
        aide={
          email.trim().toLowerCase() !== (p.contact.email ?? '').trim().toLowerCase() && email.trim()
            ? 'L’adresse de sa fiche sera remplacée par celle-ci.'
            : 'Le lien de connexion part à cette adresse. Il est valable 7 jours et ne sert qu’une fois.'
        }
      >
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
      </Field>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => void inviter()} chargement={enCours === 'inviter'} disabled={ferme || !!enCours}>
          {acces && acces.statut !== 'retire' ? 'Renvoyer une invitation' : 'Inviter'}
        </Button>
        {acces && acces.statut !== 'retire' && !confirmer && (
          <Button variant="ghost" onClick={() => setConfirmer(true)} disabled={ferme || !!enCours}>
            Retirer l’accès
          </Button>
        )}
      </div>
      {confirmer && (
        <Alert
          tone="danger"
          className="mt-3"
          actions={
            <>
              <Button variant="danger" size="sm" onClick={() => void retirer()} chargement={enCours === 'retirer'}>
                Retirer
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmer(false)}>
                Annuler
              </Button>
            </>
          }
        >
          Ses liens ne marchent plus. Son espace se ferme dès qu’il recharge la page ou ouvre un document.
        </Alert>
      )}
      {erreur && (
        <p role="alert" className="mt-2 text-[12.5px] font-medium text-(--lm-danger)">
          {erreur}
        </p>
      )}
      {invitation && (
        <div className="mt-3 rounded-xl border border-(--lm-bord) bg-(--lm-surface-2) p-3">
          <p className="text-[13px] text-(--lm-encre)">
            {invitation.envoye
              ? `Invitation envoyée à ${email.trim().toLowerCase()}. Vous pouvez aussi lui envoyer ce lien par SMS ou WhatsApp.`
              : MODE_DEMO
                ? 'Démonstration : aucun e-mail n’est envoyé. Ce lien ouvre son espace de démonstration.'
                : 'L’e-mail n’a pas pu partir : copiez ce lien et envoyez-le par SMS ou WhatsApp.'}
          </p>
          <div className="mt-2 flex gap-2">
            <Input readOnly value={invitation.lien} onFocus={(e) => e.currentTarget.select()} aria-label="Lien d’invitation" className="text-[12.5px]" />
            <Button variant="secondary" icone={copie ? <Check /> : <Copy />} onClick={() => void copier()}>
              {copie ? 'Copié' : 'Copier'}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

/* ---------------------------------------------------------------- bilans */

function Bilans({ proprietaire: p }: { proprietaire: Proprietaire }) {
  const d = useErp();
  const [ouvert, setOuvert] = useState<string>();
  const publies = d.donnees.bilansProprietaire.filter((b) => b.proprietaireId === p.id);
  // Six derniers mois terminés ayant des nuits, plus les bilans déjà préparés.
  const mois = [...new Set([...moisTermines(AUJOURDHUI, 6), ...publies.map((b) => b.mois)])]
    .sort()
    .reverse()
    .map((m) => ({ m, calcule: bilanMensuel(d.donnees, p.id, m) }))
    .filter(({ m, calcule }) => calcule.totaux.nuits > 0 || publies.some((b) => b.mois === m));
  return (
    <section>
      <Titre description="Calculés chaque mois sur les séjours, visibles par le propriétaire une fois publiés.">Bilans mensuels</Titre>
      {!mois.length && <p className="text-[13.5px] text-(--lm-encre-2)">Aucun séjour sur les six derniers mois.</p>}
      <ul className={mois.length ? 'divide-y divide-(--lm-bord) rounded-xl border border-(--lm-bord)' : 'hidden'}>
        {mois.map(({ m, calcule }) => {
          const b = publies.find((x) => x.mois === m);
          const etat = etatBilan(d.donnees, p.id, m, b);
          return (
            <li key={m} className="flex items-center gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium text-(--lm-encre)">{titreMois(m)}</p>
                <p className="lm-chiffres text-[12.5px] text-(--lm-encre-2)">
                  {euros(etat.chiffres.totaux.net, true)} pour lui · {etat.chiffres.totaux.nuits} nuits
                </p>
              </div>
              {etat.statut === 'transfere' ? (
                <Badge tone="neutre">Logement transféré</Badge>
              ) : b?.statut === 'publie' ? (
                <Badge tone={etat.statut === 'a_mettre_a_jour' ? 'alerte' : 'succes'}>{etat.statut === 'a_mettre_a_jour' ? 'À mettre à jour' : 'Publié'}</Badge>
              ) : b ? (
                <Badge tone="neutre">Brouillon</Badge>
              ) : null}
              <Button variant="secondary" size="sm" onClick={() => setOuvert(m)}>
                Ouvrir
              </Button>
            </li>
          );
        })}
      </ul>
      {ouvert && <EditeurBilan proprietaire={p} mois={ouvert} onFermer={() => setOuvert(undefined)} />}
    </section>
  );
}

function EditeurBilan({ proprietaire: p, mois, onFermer }: { proprietaire: Proprietaire; mois: string; onFermer: () => void }) {
  const d = useErp();
  const id = `${p.id}-${mois}`;
  const existant = d.donnees.bilansProprietaire.find((b) => b.id === id);
  const [commentaire, setCommentaire] = useState(existant?.commentaire ?? '');
  const etat = useMemo(() => etatBilan(d.donnees, p.id, mois, existant), [d.donnees, p.id, mois, existant]);
  const transfere = etat.statut === 'transfere';
  const chiffres = etat.chiffres;
  const publie = existant?.statut === 'publie';
  // Transféré : les chiffres publiés restent figés (etat.chiffres) ; seul le mot peut changer.
  const change = publie && ((!transfere && !memesChiffres(existant.chiffres, chiffres)) || existant.commentaire !== commentaire);

  const enregistrer = (statut: BilanProprietaire['statut']) => {
    const maintenant = horodatageMaintenant();
    const base = { id, proprietaireId: p.id, mois, commentaire: commentaire.trim(), chiffres, majLe: maintenant };
    d.upsert(
      'bilansProprietaire',
      statut === 'publie' ? { ...base, statut, publieLe: maintenant, publiePar: d.utilisateur.email } : { ...base, statut },
    );
    onFermer();
  };

  return (
    <Modal
      ouvert
      onFermer={onFermer}
      taille="lg"
      titre={bilanDuMois(mois)}
      description={
        publie
          ? `Publié le ${dateCourte(existant.publieLe!.slice(0, 10))}.${
              transfere
                ? ` ${etat.transferts.map((t) => `${t.nom} a changé de propriétaire${t.depuis ? ` le ${dateCourte(t.depuis)}` : ''}`).join(' ; ')} : ce bilan reste tel quel.`
                : change
                  ? ' Les chiffres ou le mot ont changé depuis : « Mettre à jour » remplace ce que voit le propriétaire.'
                  : ''
            }`
          : 'Aperçu exact de ce que verra le propriétaire une fois publié.'
      }
      pied={
        publie ? (
          <>
            <Button variant="ghost" onClick={() => enregistrer('brouillon')}>
              Dépublier
            </Button>
            <Button variant="primary" onClick={() => enregistrer('publie')} disabled={!change}>
              Mettre à jour
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={() => enregistrer('brouillon')}>
              Garder en brouillon
            </Button>
            <Button variant="primary" onClick={() => enregistrer('publie')}>
              Publier
            </Button>
          </>
        )
      }
    >
      <Field label={`Le mot ${deNom(espaceOuvert().nom)}`} aide="Facultatif : ce qui a marqué le mois (travaux, remplacement, avis, conseils).">
        <Textarea rows={3} value={commentaire} onChange={(e) => setCommentaire(e.target.value)} maxLength={1200} />
      </Field>
      <div className="mt-5 border-t border-(--lm-bord) pt-5">
        <BilanDetail bilan={{ mois, commentaire, chiffres, publieLe: publie ? existant.publieLe : undefined }} proprietaire={p.nom} gerant />
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------- documents */

function Documents({ proprietaire: p, logement }: { proprietaire: Proprietaire; logement?: Logement }) {
  const d = useErp();
  const [categorie, setCategorie] = useState<CategorieDocumentProprietaire>('contrat');
  const [titre, setTitre] = useState('');
  const [aRetirer, setARetirer] = useState<string>();
  // Le PDF d'une facture ne compte que si la facture est partagée (comme dans l'espace du propriétaire).
  const documents = d.donnees.documentsProprietaire
    .filter((x) => x.proprietaireId === p.id)
    .filter((x) => !x.factureId || facturePartagee(d.donnees.factures.find((f) => f.id === x.factureId)!, p.id))
    .sort((a, b) => String(b.ajouteLe).localeCompare(String(a.ajouteLe)));

  const deposer = (urls: string[], fichiers: File[]) => {
    const maintenant = horodatageMaintenant();
    urls.forEach((url, i) => {
      const nom = fichiers[i]?.name ?? 'document';
      d.upsert('documentsProprietaire', {
        id: nouvelId('docp'),
        proprietaireId: p.id,
        ...(logement ? { logementId: logement.id } : {}),
        categorie,
        titre: (urls.length === 1 && titre.trim()) || nom.replace(/\.[a-z0-9]{1,5}$/i, ''),
        fichier: url,
        nomFichier: nom,
        ajouteLe: maintenant,
        ajoutePar: d.utilisateur.email,
      });
    });
    setTitre('');
  };

  return (
    <section>
      <Titre description="Contrat, attestations, bilans signés : le propriétaire les ouvre depuis son espace.">Documents partagés</Titre>
      {documents.length ? (
        <ul className="mb-4 divide-y divide-(--lm-bord) rounded-xl border border-(--lm-bord)">
          {documents.map((doc) => (
            <li key={doc.id} className="flex items-center gap-3 px-3 py-2">
              <FileText className="size-4 shrink-0 text-(--lm-or-texte)" aria-hidden />
              <div className="min-w-0 flex-1">
                <LienFichier url={doc.fichier} className="block truncate text-[13.5px] font-medium text-(--lm-encre) hover:text-(--lm-or-texte)">
                  {doc.titre}
                </LienFichier>
                <p className="truncate text-[12px] text-(--lm-encre-2)">
                  {LIBELLE_CATEGORIE[doc.categorie]} · {dateCourte(doc.ajouteLe.slice(0, 10))}
                </p>
              </div>
              {aRetirer === doc.id ? (
                <>
                  <Button variant="danger" size="sm" onClick={() => d.remove('documentsProprietaire', doc.id)}>
                    Retirer
                  </Button>
                  <IconButton label="Annuler" size="sm" onClick={() => setARetirer(undefined)}>
                    <X />
                  </IconButton>
                </>
              ) : (
                <IconButton label={`Retirer ${doc.titre}`} size="sm" onClick={() => setARetirer(doc.id)} disabled={d.lectureSeule}>
                  <Trash2 />
                </IconButton>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-4 text-[13.5px] text-(--lm-encre-2)">Aucun document partagé pour l’instant.</p>
      )}
      <div className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
        <Field label="Catégorie">
          <Select
            value={categorie}
            onChange={(e) => setCategorie(e.target.value as CategorieDocumentProprietaire)}
            options={CATEGORIES_DOCUMENT.map((c) => ({ valeur: c.valeur, libelle: c.libelle }))}
          />
        </Field>
        <Field label="Titre" aide="Sinon, le nom du fichier.">
          <Input value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Ex. Attestation d’assurance 2026" />
        </Field>
      </div>
      <EnvoiFichier
        className="mt-3"
        dossier={`proprietaires/${p.id}`}
        accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx"
        multiple
        libelle="Déposer un document"
        disabled={d.lectureSeule}
        onEnvoye={deposer}
      />
    </section>
  );
}

/* ---------------------------------------------------------------- aperçu */

/** Lien d'un document dans l'aperçu du gérant : le fichier de l'ERP (session de l'équipe). */
function useLienDocumentGerant() {
  const d = useErp();
  return useMemo(
    () =>
      function LienDocumentGerant({ id, className, children }: LienDocumentProps) {
        const doc = d.donnees.documentsProprietaire.find((x) => x.id === id);
        return doc ? (
          <LienFichier url={doc.fichier} className={className}>
            {children}
          </LienFichier>
        ) : (
          <span className={className}>{children}</span>
        );
      },
    [d.donnees.documentsProprietaire],
  );
}

/** L'espace tel que le propriétaire le voit, calculé avec les mêmes règles que le serveur. */
function ApercuEspace({ proprietaire: p, onFermer }: { proprietaire: Proprietaire; onFermer: () => void }) {
  const d = useErp();
  const ref = useFenetre<HTMLDivElement>(true, onFermer);
  const [onglet, setOnglet] = useState<OngletEspace>('accueil');
  const [bilan, setBilan] = useState<string>();
  const [mois, setMois] = useState<string>();
  const LienDocument = useLienDocumentGerant();
  const vue = useMemo(() => vueProprietaire(d.donnees, p.id, { aujourdhui: AUJOURDHUI, mois }), [d.donnees, p.id, mois]);
  // Bandeau « Fermer » hors de la zone qui défile : toujours visible.
  return (
    <div ref={ref} role="dialog" aria-modal="true" aria-label={`Espace de ${p.nom}`} tabIndex={-1} className="fixed inset-0 z-[60] flex flex-col bg-(--lm-fond) outline-none">
      <div className="flex shrink-0 items-center justify-between gap-3 bg-(--lm-encre) px-4 py-2 text-white">
        <p className="min-w-0 truncate text-[13px] font-medium">Aperçu · ce que voit {p.nom}</p>
        <button
          type="button"
          onClick={onFermer}
          className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-[13px] font-medium hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white focus:outline-none"
        >
          <X className="size-4" aria-hidden />
          Fermer
        </button>
      </div>
      <div className="lm-defilement min-h-0 flex-1 overflow-y-auto">
        {vue ? (
          <EspaceVue
            vue={vue}
            onglet={onglet}
            onOnglet={(o) => {
              setOnglet(o);
              setBilan(undefined);
            }}
            bilan={bilan}
            onBilan={setBilan}
            onMoisCalendrier={setMois}
            LienDocument={LienDocument}
          />
        ) : (
          <div className="grid min-h-screen place-items-center p-6 text-center">
            <div>
              <p className="text-[14px] text-(--lm-encre-2)">Pas d’espace pour ce propriétaire.</p>
              <Button variant="secondary" className="mt-3" onClick={onFermer}>
                Fermer
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

