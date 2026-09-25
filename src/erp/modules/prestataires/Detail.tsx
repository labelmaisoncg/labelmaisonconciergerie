import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Mail, Pause, Phone, Play, SearchX, Upload } from 'lucide-react';
import { AUJOURDHUI, note } from '../../data/format';
import { LIBELLES } from '../../data/libelles';
import { useErp } from '../../data/store';
import { prestataireConforme } from '../../data/selectors';
import type { TypeDocument } from '../../data/types';
import { Alert, Avatar, Button, Card, EmptyState, PageHeader, StatusBadge, Tabs } from '../../ui';
import { Retour, useRetour } from '../menages/_composants/retour';
import { Missions, Paiements, Qualite } from './_composants/Activite';
import { BadgeConformite, RegleConformite } from './_composants/conformite';
import { DocumentModal } from './_composants/DocumentModal';
import { Documents, Tarifs } from './_composants/Documents';

const ONGLETS = ['documents', 'tarifs', 'missions', 'qualite', 'paiements'] as const;
type CleOnglet = (typeof ONGLETS)[number];

export function Detail() {
  const { id } = useParams();
  const d = useErp();
  const [params, setParams] = useSearchParams();
  const [docType, setDocType] = useState<TypeDocument | null>(null);
  const { message, setMessage, fermer } = useRetour();
  const p = d.prestataires.find((x) => x.id === id);
  const onglet: CleOnglet = (ONGLETS as readonly string[]).includes(params.get('onglet') ?? '') ? (params.get('onglet') as CleOnglet) : 'documents';

  if (!p)
    return (
      <>
        <PageHeader fil={[{ libelle: 'Prestataires', to: '/erp/prestataires' }, { libelle: 'Introuvable' }]} titre="Prestataire introuvable" />
        <EmptyState icone={<SearchX />} titre="Ce prestataire n’existe plus" action={<Link to="/erp/prestataires" className="text-(--lm-or) underline">Retour à la liste</Link>} />
      </>
    );

  const verdict = prestataireConforme(p);
  const aVenir = d.missions.filter((m) => m.prestataireId === p.id && m.date >= AUJOURDHUI && ['attribuee', 'en_cours'].includes(m.statut));
  const info = (texte: string) => setMessage({ ton: 'succes', texte });

  const suspendre = () => {
    d.upsert('prestataires', { ...p, statut: 'suspendu' });
    setMessage({
      ton: 'alerte',
      texte: aVenir.length ? `${p.nom} est suspendu. ${aVenir.length} mission(s) à venir doivent être réattribuées.` : `${p.nom} est suspendu : aucune nouvelle mission possible.`,
    });
  };
  const reactiver = () => {
    const suivant = { ...p, statut: 'actif' as const };
    d.upsert('prestataires', suivant);
    const v = prestataireConforme(suivant);
    setMessage(v.ok ? { ton: 'succes', texte: `${p.nom} est réactivé.` } : { ton: 'alerte', texte: `${p.nom} est réactivé mais reste non conforme : ${v.raisons.join(' ')}` });
  };

  return (
    <>
      <PageHeader
        fil={[{ libelle: 'Prestataires', to: '/erp/prestataires' }, { libelle: p.nom }]}
        titre={
          <span className="flex flex-wrap items-center gap-3">
            <Avatar nom={p.nom} taille="lg" />
            {p.nom}
          </span>
        }
        sousTitre={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge type="statutPrestataire" valeur={p.statut} />
            <BadgeConformite prestataire={p} />
            <span>{LIBELLES.typePrestataire[p.type]}</span>
            {p.raisonSociale && <span>· {p.raisonSociale}</span>}
          </span>
        }
        actions={
          <>
            <Button icone={<Upload />} onClick={() => setDocType('contrat')}>Mettre à jour un document</Button>
            {p.statut === 'actif' && <Button variant="danger" icone={<Pause />} onClick={suspendre}>Suspendre</Button>}
            {p.statut === 'suspendu' && <Button variant="primary" icone={<Play />} onClick={reactiver}>Réactiver</Button>}
          </>
        }
      />

      <Retour message={message} onFermer={fermer} />
      {!verdict.ok ? (
        <Alert tone="danger" titre="Il manque des papiers : on ne peut pas lui confier de ménage" className="mb-4">
          {verdict.raisons.join(' ')}
          {aVenir.length > 0 && ` ${aVenir.length} mission(s) à venir lui sont encore attribuées : réattribuez-les.`}
        </Alert>
      ) : (
        <RegleConformite className="mb-4" />
      )}

      <Card className="mb-5">
        <dl className="grid gap-x-6 gap-y-3 text-[13px] sm:grid-cols-2 lg:grid-cols-5">
          <div><dt className="text-(--lm-encre-2)">Téléphone</dt><dd className="font-medium"><a href={`tel:${p.telephone}`} className="inline-flex items-center gap-1 hover:text-(--lm-or)"><Phone className="size-3.5" aria-hidden />{p.telephone}</a></dd></div>
          <div><dt className="text-(--lm-encre-2)">E-mail</dt><dd className="truncate font-medium">{p.email ? <a href={`mailto:${p.email}`} className="inline-flex items-center gap-1 hover:text-(--lm-or)"><Mail className="size-3.5" aria-hidden />{p.email}</a> : '-'}</dd></div>
          <div><dt className="text-(--lm-encre-2)">SIRET</dt><dd className="lm-chiffres font-medium">{p.siret ?? 'Non renseigné'}</dd></div>
          <div><dt className="text-(--lm-encre-2)">Zone</dt><dd className="font-medium">{p.zone.join(', ') || '-'}</dd></div>
          <div><dt className="text-(--lm-encre-2)">Note / missions</dt><dd className="lm-chiffres font-medium">{note(p.noteMoyenne)} · {p.missionsRealisees} réalisées</dd></div>
        </dl>
      </Card>

      <Tabs
        label="Sections du prestataire"
        actif={onglet}
        onChange={(c) => setParams(c === 'documents' ? {} : { onglet: c }, { replace: true })}
        onglets={[
          { cle: 'documents', libelle: 'Documents' },
          { cle: 'tarifs', libelle: 'Tarifs', compteur: p.tarifs.length },
          { cle: 'missions', libelle: 'Missions', compteur: d.missions.filter((m) => m.prestataireId === p.id).length },
          { cle: 'qualite', libelle: 'Qualité' },
          { cle: 'paiements', libelle: 'Paiements' },
        ]}
      />
      {onglet === 'documents' && <Documents prestataire={p} onMettreAJour={setDocType} />}
      {onglet === 'tarifs' && <Tarifs prestataire={p} onMessage={info} />}
      {onglet === 'missions' && <Missions prestataire={p} />}
      {onglet === 'qualite' && <Qualite prestataire={p} />}
      {onglet === 'paiements' && <Paiements prestataire={p} />}

      <DocumentModal prestataire={p} type={docType} onFermer={() => setDocType(null)} onSucces={info} />
    </>
  );
}
