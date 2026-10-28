/**
 * CRM d'appels (/erp/crm) : deux vues. « Aujourd’hui » : la file de
 * l'assistant CRM (à appeler ou relancer, la plus prioritaire en premier,
 * prochaine action et brouillon de relance en un clic). « Tous les
 * contacts » : toutes les personnes, ligne par ligne, façon Airtable. Chaque
 * formulaire du site crée automatiquement une ligne « À appeler »
 * (api/contact.ts → api/_erp-crm.ts) ; l'équipe la fait avancer d'étape en
 * étape. Mise à jour en direct (Supabase Realtime). Rien n'est envoyé aux
 * contacts depuis l'ERP.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bot, CalendarPlus, Check, FileText, PhoneCall, Plus } from 'lucide-react';
import { idContactCrm, STATUTS_CRM, telephoneNormalise, trouverDoublon } from '../../data/crm';
import { fileDuJour, jourMoisCrm } from '../../data/crm-assistant';
import { espaceOuvert } from '../../data/espaces';
import { AUJOURDHUI, horodatageMaintenant } from '../../data/format';
import { aideCrmVide, dossierProprietaireDisponible } from '../../data/marque-espace';
import { useErp } from '../../data/store';
import type { ContactCrm } from '../../data/types';
import { Alert, Button, EmptyState, Field, FilterChips, Input, MenuActions, Modal, PageHeader, SearchInput, Segmente, Textarea, Toolbar, useRechercheUrl } from '../../ui';
import { AgendaCrm } from './_composants/AgendaCrm';
import { ConnecterClaude } from './_composants/ConnecterClaude';
import { EnvoyerDossier } from './_composants/EnvoyerDossier';
import { FicheContact } from './_composants/FicheContact';
import { FileDuJour } from './_composants/FileDuJour';
import { Grille } from './_composants/Grille';
import { ListeMobile } from './_composants/ListeMobile';
import { PreparerRelance } from './_composants/PreparerRelance';

type Vue = 'jour' | 'tous';

function NouveauContact({ ouvert, onFermer, contacts, onOuvrir }: { ouvert: boolean; onFermer: () => void; contacts: ContactCrm[]; onOuvrir: (id: string) => void }) {
  const { upsert, utilisateur } = useErp();
  const [f, setF] = useState({ nom: '', telephone: '', email: '', ville: '', typeBien: '', notes: '' });
  const doublon = useMemo(
    () => (f.email.trim() || telephoneNormalise(f.telephone).length >= 9 ? trouverDoublon(contacts, { email: f.email, telephone: f.telephone }) : undefined),
    [contacts, f.email, f.telephone],
  );
  const fermer = () => {
    setF({ nom: '', telephone: '', email: '', ville: '', typeBien: '', notes: '' });
    onFermer();
  };
  const creer = () => {
    const maintenant = horodatageMaintenant();
    const c: ContactCrm = {
      id: idContactCrm(),
      nom: f.nom.trim(),
      ...(f.telephone.trim() ? { telephone: f.telephone.trim() } : {}),
      ...(f.email.trim() ? { email: f.email.trim().toLowerCase() } : {}),
      ...(f.ville.trim() ? { ville: f.ville.trim() } : {}),
      ...(f.typeBien.trim() ? { typeBien: f.typeBien.trim() } : {}),
      source: 'manuel',
      statut: 'a_appeler',
      notes: f.notes.trim(),
      tentatives: 0,
      historique: [{ le: maintenant, par: utilisateur.nom, resultat: 'note', texte: 'Contact ajouté à la main.' }],
      creeLe: maintenant,
      majLe: maintenant,
    };
    upsert('crm', c);
    fermer();
  };
  const champ = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <Modal
      ouvert={ouvert}
      onFermer={fermer}
      titre="Nouveau contact"
      pied={
        <>
          <Button variant="ghost" onClick={fermer}>
            Annuler
          </Button>
          <Button variant="primary" icone={<Plus />} disabled={!f.nom.trim() || (!f.telephone.trim() && !f.email.trim())} onClick={creer}>
            Ajouter
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Nom" requis>
            <Input value={f.nom} onChange={champ('nom')} autoFocus />
          </Field>
        </div>
        <Field label="Téléphone">
          <Input type="tel" value={f.telephone} onChange={champ('telephone')} />
        </Field>
        <Field label="E-mail">
          <Input type="email" value={f.email} onChange={champ('email')} />
        </Field>
        <Field label="Ville">
          <Input value={f.ville} onChange={champ('ville')} />
        </Field>
        <Field label="Bien">
          <Input value={f.typeBien} onChange={champ('typeBien')} placeholder="T2, maison…" />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Notes">
            <Textarea rows={2} value={f.notes} onChange={champ('notes')} />
          </Field>
        </div>
      </div>
      {!f.telephone.trim() && !f.email.trim() && <p className="mt-3 text-[12.5px] text-(--lm-encre-2)">Téléphone ou e-mail requis.</p>}
      {doublon && (
        <Alert
          tone="alerte"
          className="mt-3"
          titre={`${doublon.nom} est déjà dans le CRM avec ce numéro ou cet e-mail.`}
          actions={
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                fermer();
                onOuvrir(doublon.id);
              }}
            >
              Ouvrir sa fiche
            </Button>
          }
        />
      )}
    </Modal>
  );
}

export default function Crm() {
  const { crm, upsert, remove, utilisateur, lectureSeule, mode } = useErp();
  const [claude, setClaude] = useState(false);
  const [lienDossier, setLienDossier] = useState(false);
  const [agenda, setAgenda] = useState(false);
  const gerant = utilisateur.role === 'gerant';
  // Le dossier propriétaire du site remplit le CRM de Label Maison : jamais proposé dans un autre espace.
  const espace = espaceOuvert();
  const dossier = dossierProprietaireDisponible(espace);
  const plus = [
    ...(dossier ? [{ libelle: 'Lien du dossier propriétaire', icone: <FileText />, onClick: () => setLienDossier(true) }] : []),
    ...(gerant
      ? [
          { libelle: 'Relances dans Calendrier', icone: <CalendarPlus />, onClick: () => setAgenda(true) },
          { libelle: 'Connecter à Claude', icone: <Bot />, onClick: () => setClaude(true) },
        ]
      : []),
  ];
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useRechercheUrl();
  const [filtres, setFiltres] = useState<string[]>([]);
  const [nouveau, setNouveau] = useState(false);

  const ouvert = params.get('contact');
  const relance = params.get('relance');
  // Changer des paramètres de l'adresse (fiche, relance, vue) en une fois, sans toucher aux autres.
  const regler = (changements: Record<string, string | null>) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p);
        for (const [cle, valeur] of Object.entries(changements)) {
          if (valeur) n.set(cle, valeur);
          else n.delete(cle);
        }
        return n;
      },
      { replace: true },
    );
  const ouvrir = (id: string | null) => regler({ contact: id, ...(id ? { relance: null } : {}) });
  // « Préparer la relance » : le brouillon est demandé dès l'ouverture (un clic).
  const [relanceAuto, setRelanceAuto] = useState(false);
  const preparerRelance = (id: string | null, auto = true) => {
    setRelanceAuto(auto);
    regler({ relance: id, ...(id ? { contact: null } : {}) });
  };

  const modifier = (c: ContactCrm) => upsert('crm', { ...c, majLe: horodatageMaintenant() });

  // « C’est envoyé » : la relance est notée, la confirmation reste quelques secondes sur la page.
  const [notee, setNotee] = useState<string | null>(null);
  const minuteurNotee = useRef<number>();
  useEffect(() => () => window.clearTimeout(minuteurNotee.current), []);
  const relanceEnvoyee = (c: ContactCrm) => {
    modifier(c);
    // La vue reste « Aujourd’hui » même si la file se vide.
    regler({ relance: null, vue: 'jour' });
    setNotee(`Relance notée pour ${c.nom}.${c.relanceLe ? ` Prochaine relance le ${jourMoisCrm(c.relanceLe)}`.replace(/\.?$/, '.') : ''}`);
    window.clearTimeout(minuteurNotee.current);
    minuteurNotee.current = window.setTimeout(() => setNotee(null), 8000);
  };

  // La file du jour (assistant CRM) : même règle que « À faire » de l'Accueil et l'agenda.
  const file = useMemo(() => fileDuJour(crm, AUJOURDHUI), [crm]);
  const aujourdhui = file.length;
  const vue: Vue = params.get('vue') === 'tous' || (params.get('vue') !== 'jour' && !aujourdhui) ? 'tous' : 'jour';

  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase();
    const chiffres = telephoneNormalise(t);
    return crm.filter((c) => {
      if (filtres.length && !filtres.includes(c.statut)) return false;
      if (!t) return true;
      return (
        [c.nom, c.email, c.ville, c.typeBien, c.notes].some((v) => (v ?? '').toLowerCase().includes(t)) ||
        (chiffres.length >= 3 && telephoneNormalise(c.telephone).includes(chiffres))
      );
    });
  }, [crm, q, filtres]);

  return (
    <>
      <PageHeader
        titre="CRM"
        sousTitre={crm.length > 0 && aujourdhui ? `${aujourdhui} à appeler aujourd’hui.` : undefined}
        actions={
          <>
            {plus.length > 0 && <MenuActions texte label="Plus" actions={plus} />}
            {crm.length > 0 && !lectureSeule && (
              <Button variant="primary" icone={<Plus />} onClick={() => setNouveau(true)}>
                Nouveau contact
              </Button>
            )}
          </>
        }
      />

      {crm.length > 0 && (
        <Segmente
          className="mb-4"
          label="Vue du CRM"
          valeur={vue}
          onChange={(v) => regler({ vue: v })}
          options={[
            { valeur: 'jour', libelle: 'Aujourd’hui' },
            { valeur: 'tous', libelle: 'Tous les contacts' },
          ]}
        />
      )}

      <div role="status" aria-live="polite">
        {notee && (
          <p className="mb-3 flex items-center gap-2 rounded-lg bg-(--lm-succes-lavis) px-3 py-2 text-[13.5px] text-(--lm-succes-texte)">
            <Check className="size-4 shrink-0" aria-hidden />
            {notee}
          </p>
        )}
      </div>

      {crm.length > 0 && vue === 'jour' ? (
        file.length ? (
          // Lecture seule : la prochaine action et l'appel, sans brouillon demandé à l'IA.
          <FileDuJour entrees={file} onOuvrir={(e) => preparerRelance(e.contact.id, !lectureSeule)} />
        ) : (
          <EmptyState icone={<PhoneCall />} titre="Personne à appeler aujourd’hui." action={<Button variant="ghost" onClick={() => regler({ vue: 'tous' })}>Voir tous les contacts</Button>} />
        )
      ) : crm.length === 0 ? (
        <EmptyState
          icone={<PhoneCall />}
          titre="Aucun contact pour l’instant"
          description={aideCrmVide(espace)}
          action={
            !lectureSeule && (
              <Button variant="primary" icone={<Plus />} onClick={() => setNouveau(true)}>
                Nouveau contact
              </Button>
            )
          }
        />
      ) : (
        <>
          <Toolbar className="mb-3">
            <SearchInput valeur={q} onChange={setQ} placeholder="Nom, téléphone, ville…" label="Rechercher un contact" />
            <FilterChips
              className="lm-defilement -mx-4 flex-nowrap overflow-x-auto px-4 pb-0.5 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0"
              label="Filtrer par étape"
              actifs={filtres}
              onChange={setFiltres}
              filtres={STATUTS_CRM.map((s) => ({ cle: s.cle, libelle: s.libelle }))}
            />
          </Toolbar>
          {visibles.length ? (
            <>
              <div className="sm:hidden">
                <ListeMobile contacts={visibles} onOuvrir={ouvrir} onModifier={modifier} lectureSeule={lectureSeule} />
              </div>
              <div className="hidden sm:block">
                <Grille contacts={visibles} onOuvrir={ouvrir} onModifier={modifier} lectureSeule={lectureSeule} />
              </div>
            </>
          ) : (
            <EmptyState titre="Aucun contact ne correspond" action={<Button variant="ghost" onClick={() => { setQ(''); setFiltres([]); }}>Tout afficher</Button>} />
          )}
        </>
      )}

      <FicheContact
        contact={ouvert ? crm.find((c) => c.id === ouvert) : undefined}
        onFermer={() => ouvrir(null)}
        onModifier={modifier}
        onSupprimer={(id) => {
          ouvrir(null);
          remove('crm', id);
        }}
        auteur={utilisateur.nom}
        lectureSeule={lectureSeule}
        dossier={dossier}
        onRelance={(id) => preparerRelance(id, false)}
      />
      <PreparerRelance
        contact={relance ? crm.find((c) => c.id === relance) : undefined}
        auto={relanceAuto}
        onFermer={() => preparerRelance(null, false)}
        onEnvoye={relanceEnvoyee}
        onOuvrirFiche={(id) => ouvrir(id)}
        auteur={utilisateur.nom}
        lectureSeule={lectureSeule}
      />
      {gerant && <ConnecterClaude ouvert={claude} onFermer={() => setClaude(false)} demo={mode !== 'reel'} />}
      {gerant && <AgendaCrm ouvert={agenda} onFermer={() => setAgenda(false)} demo={mode !== 'reel'} />}
      {dossier && <EnvoyerDossier ouvert={lienDossier} onFermer={() => setLienDossier(false)} />}
      {!lectureSeule && <NouveauContact ouvert={nouveau} onFermer={() => setNouveau(false)} contacts={crm} onOuvrir={ouvrir} />}
    </>
  );
}
