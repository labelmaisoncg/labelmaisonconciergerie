/**
 * Espace propriétaire, côté gérant (carte « Propriétaire » de la fiche
 * logement) : inviter ou retirer l'accès, partager des documents, préparer
 * puis publier les bilans mensuels, et voir l'espace tel que le propriétaire
 * le voit. Les accès sont écrits par le serveur (api/espace-proprietaire.ts) ;
 * documents et bilans passent par le store comme le reste de l'ERP.
 */
import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Eye, FileText, Trash2, X } from 'lucide-react';
import { MODE_DEMO } from '../../../data/config';
import { AUJOURDHUI, dateCourte, euros } from '../../../data/format';
import { nouvelId, useErp } from '../../../data/store';
import {
  CATEGORIES_DOCUMENT,
  LIBELLE_CATEGORIE,
  bilanMensuel,
  memesChiffres,
  moisTermines,
  vueProprietaire,
} from '../../../data/proprietaire';
import type { Logement, Proprietaire } from '../../../data/types';
import type { AccesProprietaire, BilanProprietaire, CategorieDocumentProprietaire } from '../../../data/types-proprietaire';
import { BilanDetail } from '../../../espace-proprietaire/Bilans';
import { EspaceVue } from '../../../espace-proprietaire/EspaceVue';
import { bilanDuMois, titreMois, type LienDocumentProps, type OngletEspace } from '../../../espace-proprietaire/commun';
import { Alert, Badge, Button, Drawer, EnvoiFichier, Field, IconButton, Input, LienFichier, Modal, Select, Textarea, useFenetre } from '../../../ui';
import { appelerServeur } from '../../messagerie/_composants/serveur';

interface EtatServeur {
  actif: boolean;
  email: boolean;
  raison?: string;
}

const API = '/api/espace-proprietaire';

/** État de l'accès en une ligne (« Connecté le 21 sept. 2026 »), aussi pour Paramètres → Accès. */
export function statutAcces(a: AccesProprietaire | undefined): { texte: string; ton: 'neutre' | 'succes' | 'alerte' } {
  if (!a) return { texte: 'Pas encore invité', ton: 'neutre' };
  if (a.statut === 'retire') return { texte: `Accès retiré${a.retireLe ? ` le ${dateCourte(a.retireLe.slice(0, 10))}` : ''}`, ton: 'neutre' };
  if (a.statut === 'actif') return { texte: `Connecté${a.derniereConnexion ? ` le ${dateCourte(a.derniereConnexion.slice(0, 10))}` : ''}`, ton: 'succes' };
  return { texte: `Invité le ${dateCourte(a.inviteLe.slice(0, 10))}`, ton: 'alerte' };
}

/** Ligne de la carte Propriétaire : état de l'accès et ouverture du panneau. */
export function CarteEspaceProprietaire({ proprietaire, logement }: { proprietaire: Proprietaire; logement: Logement }) {
  const d = useErp();
  const [ouvert, setOuvert] = useState(false);
  const acces = d.donnees.accesProprietaires.find((a) => a.id === proprietaire.id);
  const s = statutAcces(acces);
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-(--lm-bord) pt-3">
      <div className="min-w-0">
        <p className="text-[13.5px] font-medium text-(--lm-encre)">Espace propriétaire</p>
        <p className="text-[12.5px] text-(--lm-encre-2)">{s.texte}</p>
      </div>
      <Button variant="secondary" size="sm" onClick={() => setOuvert(true)}>
        {acces && acces.statut !== 'retire' ? 'Gérer' : 'Inviter'}
      </Button>
      {ouvert && <PanneauEspace proprietaire={proprietaire} logement={logement} onFermer={() => setOuvert(false)} />}
    </div>
  );
}

/** Le panneau complet (accès, bilans, documents) ; ouvert aussi depuis Paramètres → Accès, sans logement. */
export function PanneauEspace({ proprietaire: p, logement, onFermer }: { proprietaire: Proprietaire; logement?: Logement; onFermer: () => void }) {
  const [apercu, setApercu] = useState(false);
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
  const [email, setEmail] = useState(acces?.email ?? p.contact.email ?? '');
  const [enCours, setEnCours] = useState<'inviter' | 'retirer'>();
  const [erreur, setErreur] = useState<string>();
  const [invitation, setInvitation] = useState<{ lien: string; envoye: boolean }>();
  const [confirmer, setConfirmer] = useState(false);
  const [copie, setCopie] = useState(false);
  const s = statutAcces(acces);
  const ferme = !serveur?.actif;

  const inviter = async () => {
    setErreur(undefined);
    setInvitation(undefined);
    const adresse = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(adresse)) return setErreur('Adresse e-mail invalide.');
    if (MODE_DEMO) {
      const maintenant = new Date().toISOString();
      d.upsert('accesProprietaires', {
        id: p.id,
        proprietaireId: p.id,
        email: adresse,
        statut: acces?.statut === 'actif' ? 'actif' : 'invite',
        inviteLe: maintenant,
        invitePar: d.utilisateur.email,
        version: acces?.version ?? 1,
        liens: [],
        ...(acces?.derniereConnexion ? { derniereConnexion: acces.derniereConnexion } : {}),
      });
      setInvitation({ lien: `${window.location.origin}/espace-proprietaire?apercu=${encodeURIComponent(p.id)}`, envoye: false });
      return;
    }
    setEnCours('inviter');
    try {
      const r = await appelerServeur<{ lien: string; envoye: boolean }>(API, 'POST', { action: 'inviter', proprietaireId: p.id, email: adresse });
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
      if (acces) d.upsert('accesProprietaires', { ...acces, statut: 'retire', retireLe: new Date().toISOString(), version: acces.version + 1, liens: [] });
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
      <Titre description="Il voit ses logements, son calendrier, ses bilans publiés et ses documents. Rien d’autre, et il ne modifie rien.">Accès</Titre>
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
      <Field label="Adresse e-mail du propriétaire" aide="Le lien de connexion part à cette adresse. Il est valable 7 jours et ne sert qu’une fois.">
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
      </Field>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => void inviter()} chargement={enCours === 'inviter'} disabled={ferme || !!enCours}>
          {acces && acces.statut !== 'retire' ? 'Renvoyer une invitation' : 'Inviter dans l’espace propriétaire'}
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
          Le propriétaire est déconnecté tout de suite et ses liens ne marchent plus.
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
      <Titre description="Calculés chaque mois sur les séjours. Le propriétaire ne voit un bilan qu’une fois publié.">Bilans mensuels</Titre>
      {!mois.length && <p className="text-[13.5px] text-(--lm-encre-2)">Aucun séjour sur les six derniers mois.</p>}
      <ul className={mois.length ? 'divide-y divide-(--lm-bord) rounded-xl border border-(--lm-bord)' : 'hidden'}>
        {mois.map(({ m, calcule }) => {
          const b = publies.find((x) => x.mois === m);
          const change = b?.statut === 'publie' && !memesChiffres(b.chiffres, calcule);
          return (
            <li key={m} className="flex items-center gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium text-(--lm-encre)">{titreMois(m)}</p>
                <p className="lm-chiffres text-[12.5px] text-(--lm-encre-2)">
                  {euros(calcule.totaux.net, true)} pour lui · {calcule.totaux.nuits} nuits
                </p>
              </div>
              {b?.statut === 'publie' ? (
                <Badge tone={change ? 'alerte' : 'succes'}>{change ? 'À mettre à jour' : 'Publié'}</Badge>
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
  const chiffres = useMemo(() => bilanMensuel(d.donnees, p.id, mois), [d.donnees, p.id, mois]);
  const publie = existant?.statut === 'publie';
  const change = publie && (!memesChiffres(existant.chiffres, chiffres) || existant.commentaire !== commentaire);

  const enregistrer = (statut: BilanProprietaire['statut']) => {
    const maintenant = new Date().toISOString();
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
          ? `Publié le ${dateCourte(existant.publieLe!.slice(0, 10))}.${change ? ' Les chiffres ou le mot ont changé depuis : « Mettre à jour » remplace ce que voit le propriétaire.' : ''}`
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
      <Field label="Le mot de Label Maison" aide="Facultatif : ce qui a marqué le mois (travaux, remplacement, avis, conseils).">
        <Textarea rows={3} value={commentaire} onChange={(e) => setCommentaire(e.target.value)} maxLength={1200} />
      </Field>
      <div className="mt-5 border-t border-(--lm-bord) pt-5">
        <BilanDetail bilan={{ mois, commentaire, chiffres, publieLe: publie ? existant.publieLe : undefined }} proprietaire={p.nom} />
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
  const documents = d.donnees.documentsProprietaire
    .filter((x) => x.proprietaireId === p.id)
    .sort((a, b) => String(b.ajouteLe).localeCompare(String(a.ajouteLe)));

  const deposer = (urls: string[], fichiers: File[]) => {
    const maintenant = new Date().toISOString();
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
      <Titre description="Contrat, attestations, bilans signés… Le propriétaire les ouvre depuis son espace, par un lien valable 2 minutes.">Documents partagés</Titre>
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

