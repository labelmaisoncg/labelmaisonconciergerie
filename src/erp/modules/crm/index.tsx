/**
 * CRM d'appels (/erp/crm) : toutes les personnes à rappeler, ligne par ligne,
 * façon Airtable. Chaque formulaire du site crée automatiquement une ligne
 * « À appeler » (api/contact.ts → api/_erp-crm.ts) ; l'équipe la fait avancer
 * d'étape en étape. Mise à jour en direct (Supabase Realtime).
 */
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PhoneCall, Plus } from 'lucide-react';
import { aTraiterLe, idContactCrm, STATUTS_CRM, telephoneNormalise, trouverDoublon } from '../../data/crm';
import { AUJOURDHUI, horodatageMaintenant } from '../../data/format';
import { useErp } from '../../data/store';
import type { ContactCrm, StatutContactCrm } from '../../data/types';
import { Alert, Button, EmptyState, Field, FilterChips, Input, Modal, PageHeader, SearchInput, Textarea, Toolbar, useRechercheUrl } from '../../ui';
import { FicheContact } from './_composants/FicheContact';
import { Grille } from './_composants/Grille';

const FILTRE_JOUR = 'aujourdhui';

const aTraiterAujourdhui = (c: ContactCrm) => aTraiterLe(c, AUJOURDHUI);

function NouveauContact({ ouvert, onFermer, contacts }: { ouvert: boolean; onFermer: () => void; contacts: ContactCrm[] }) {
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
      {doublon && (
        <Alert tone="alerte" className="mt-3" titre={`${doublon.nom} est déjà dans le CRM avec ce numéro ou cet e-mail.`} />
      )}
    </Modal>
  );
}

export default function Crm() {
  const { crm, upsert, remove, utilisateur, lectureSeule } = useErp();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useRechercheUrl();
  const [filtres, setFiltres] = useState<string[]>([]);
  const [nouveau, setNouveau] = useState(false);

  const ouvert = params.get('contact');
  const ouvrir = (id: string | null) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p);
        if (id) n.set('contact', id);
        else n.delete('contact');
        return n;
      },
      { replace: true },
    );

  const modifier = (c: ContactCrm) => upsert('crm', { ...c, majLe: horodatageMaintenant() });

  const compte = (s: StatutContactCrm) => crm.filter((c) => c.statut === s).length;
  const aujourdhui = crm.filter(aTraiterAujourdhui).length;

  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase();
    const chiffres = t.replace(/\D/g, '');
    return crm.filter((c) => {
      if (filtres.includes(FILTRE_JOUR) && !aTraiterAujourdhui(c)) return false;
      const etapes = filtres.filter((x) => x !== FILTRE_JOUR);
      if (etapes.length && !etapes.includes(c.statut)) return false;
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
        sousTitre={aujourdhui ? `${aujourdhui} à appeler aujourd’hui.` : 'Personne à appeler aujourd’hui.'}
        actions={
          !lectureSeule && (
            <Button variant="primary" icone={<Plus />} onClick={() => setNouveau(true)}>
              Nouveau contact
            </Button>
          )
        }
      />

      {crm.length === 0 ? (
        <EmptyState
          icone={<PhoneCall />}
          titre="Aucun contact pour l’instant"
          description="Chaque formulaire envoyé depuis le site arrive ici tout seul, dans « À appeler »."
          action={
            !lectureSeule && (
              <Button variant="primary" icone={<Plus />} onClick={() => setNouveau(true)}>
                Ajouter un contact
              </Button>
            )
          }
        />
      ) : (
        <>
          <Toolbar className="mb-3">
            <SearchInput valeur={q} onChange={setQ} placeholder="Nom, téléphone, ville…" label="Rechercher un contact" />
            <FilterChips
              label="Filtrer par étape"
              actifs={filtres}
              onChange={setFiltres}
              filtres={[
                { cle: FILTRE_JOUR, libelle: 'Aujourd’hui', compteur: aujourdhui },
                ...STATUTS_CRM.map((s) => ({ cle: s.cle, libelle: s.libelle, compteur: compte(s.cle) })),
              ]}
            />
          </Toolbar>
          {visibles.length ? (
            <Grille contacts={visibles} onOuvrir={ouvrir} onModifier={modifier} lectureSeule={lectureSeule} />
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
      />
      {!lectureSeule && <NouveauContact ouvert={nouveau} onFermer={() => setNouveau(false)} contacts={crm} />}
    </>
  );
}
