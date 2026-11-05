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
import { Bot, CalendarPlus, FileText, PhoneCall, Plus } from 'lucide-react';
import { STATUTS_CRM, telephoneNormalise } from '../../data/crm';
import { fileDuJour, jourMoisCrm } from '../../data/crm-assistant';
import { espaceOuvert } from '../../data/espaces';
import { AUJOURDHUI, horodatageMaintenant } from '../../data/format';
import { aideCrmVide, dossierProprietaireDisponible } from '../../data/marque-espace';
import { useErp } from '../../data/store';
import type { ContactCrm } from '../../data/types';
import { Alert, Button, EmptyState, FilterChips, IconButton, MenuActions, PageHeader, SearchInput, Segmente, Toolbar, useRechercheUrl } from '../../ui';
import { AssistantContact } from './_composants/AssistantContact';
import { AgendaCrm } from './_composants/AgendaCrm';
import { ConnecterClaude } from './_composants/ConnecterClaude';
import { EnvoyerDossier } from './_composants/EnvoyerDossier';
import { FicheContact } from './_composants/FicheContact';
import { FileDuJour } from './_composants/FileDuJour';
import { Grille } from './_composants/Grille';
import { ListeMobile } from './_composants/ListeMobile';
import { PreparerRelance } from './_composants/PreparerRelance';

type Vue = 'jour' | 'tous';

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
          // Comme dans Logements et Réservations : le « … » rond (actions secondaires), puis le « + » rond (nouveau contact).
          <>
            {plus.length > 0 && <MenuActions label="Plus" actions={plus} />}
            {crm.length > 0 && !lectureSeule && (
              <IconButton label="Ajouter un contact" variant="secondary" onClick={() => setNouveau(true)}>
                <Plus />
              </IconButton>
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

      <div aria-live="polite">{notee && <Alert tone="succes" className="mb-3" titre={notee} />}</div>

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
      {!lectureSeule && <AssistantContact ouvert={nouveau} onFermer={() => setNouveau(false)} contacts={crm} onOuvrir={ouvrir} />}
    </>
  );
}
