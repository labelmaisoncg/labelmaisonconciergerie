import { useState } from 'react';
import { FileText, Upload } from 'lucide-react';
import { AUJOURDHUI, dateCourte, ecartJours, euros, pluriel, versCentimes } from '../../../data/format';
import { LIBELLES } from '../../../data/libelles';
import { useErp } from '../../../data/store';
import type { Prestataire, TypeDocument, TypeLogement } from '../../../data/types';
import { Button, Card, CardHeader, Field, Input, LienFichier, Select, Table, type Colonne } from '../../../ui';
import { BadgeDocument, DOCUMENTS_REQUIS, etatDocument } from './conformite';

type LigneDoc = (typeof DOCUMENTS_REQUIS)[number];

/** Documents de conformité, avec validité et mise à jour. */
export function Documents({ prestataire: p, onMettreAJour }: { prestataire: Prestataire; onMettreAJour: (t: TypeDocument) => void }) {
  const autres = p.documents.filter((d) => d.type === 'autre');
  const lignes: LigneDoc[] = [...DOCUMENTS_REQUIS, ...autres.map(() => ({ type: 'autre' as const, libelle: 'Autre document', bloquant: false, aide: '' }))];
  const colonnes: Colonne<LigneDoc>[] = [
    {
      cle: 'doc',
      titre: 'Document',
      rendu: (l) => (
        <div>
          <p className="font-medium">{l.libelle}{l.bloquant && <span className="ml-1.5 text-[11.5px] font-normal text-(--lm-danger)">obligatoire</span>}</p>
          {l.aide && <p className="text-[12px] text-(--lm-encre-3)">{l.aide}</p>}
        </div>
      ),
    },
    {
      cle: 'validite',
      titre: 'Validité',
      rendu: (l) => {
        const doc = p.documents.find((d) => d.type === l.type);
        if (!doc?.valideJusquau) return <span className="text-(--lm-encre-3)">{doc && doc.statut !== 'manquant' ? 'Sans échéance' : '-'}</span>;
        const j = ecartJours(AUJOURDHUI, doc.valideJusquau);
        return (
          <span className="lm-chiffres whitespace-nowrap">
            {dateCourte(doc.valideJusquau)}
            <span className="ml-1 text-[12px] text-(--lm-encre-3)">({j >= 0 ? `dans ${pluriel(j, 'jour')}` : `il y a ${pluriel(-j, 'jour')}`})</span>
          </span>
        );
      },
    },
    { cle: 'statut', titre: 'Statut', rendu: (l) => <BadgeDocument etat={etatDocument(p.documents.find((d) => d.type === l.type))} /> },
    {
      cle: 'fichier',
      titre: 'Pièce',
      masquerMobile: true,
      rendu: (l) => {
        const url = p.documents.find((d) => d.type === l.type)?.url;
        if (!url) return <span className="text-(--lm-encre-3)">Aucune</span>;
        return url.startsWith('demo://') ? (
          <span className="inline-flex items-center gap-1 text-(--lm-encre-2)"><FileText className="size-3.5" aria-hidden /> Déposée</span>
        ) : (
          <LienFichier url={url} className="text-(--lm-or) hover:underline">Ouvrir</LienFichier>
        );
      },
    },
    {
      cle: 'action',
      titre: 'Action',
      align: 'droite',
      rendu: (l) => (
        <Button size="sm" variant="secondary" icone={<Upload />} onClick={() => onMettreAJour(l.type)}>
          Mettre à jour
        </Button>
      ),
    },
  ];
  return <Table colonnes={colonnes} lignes={lignes} cleLigne={(l) => `${l.type}-${l.libelle}-${lignes.indexOf(l)}`} legende="Documents de conformité" />;
}

const TYPES_LOGEMENT = Object.keys(LIBELLES.typeLogement) as TypeLogement[];

/** Tarifs par type de logement, modifiables. */
export function Tarifs({ prestataire: p, onMessage }: { prestataire: Prestataire; onMessage: (t: string) => void }) {
  const { upsert } = useErp();
  const [typeLogement, setTypeLogement] = useState<TypeLogement>('T2');
  const [montant, setMontant] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);

  const enregistrer = () => {
    const c = versCentimes(montant);
    if (!montant || Number.isNaN(c) || c <= 0) return setErreur('Montant invalide.');
    const tarifs = [...p.tarifs.filter((t) => t.typeLogement !== typeLogement), { typeLogement, montantCentimes: c }].sort(
      (a, b) => TYPES_LOGEMENT.indexOf(a.typeLogement) - TYPES_LOGEMENT.indexOf(b.typeLogement),
    );
    upsert('prestataires', { ...p, tarifs });
    setMontant('');
    setErreur(null);
    onMessage(`Tarif ${LIBELLES.typeLogement[typeLogement]} enregistré : ${euros(c)}.`);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card flush>
        <CardHeader className="px-4 pt-4 sm:px-5" titre="Grille tarifaire" description="Prix d’une prestation par type de logement, hors fournitures." />
        {p.tarifs.length ? (
          <ul className="divide-y divide-(--lm-bord)">
            {p.tarifs.map((t) => (
              <li key={t.typeLogement} className="flex justify-between px-4 py-2.5 text-[13.5px] sm:px-5">
                <span>{LIBELLES.typeLogement[t.typeLogement]}</span>
                <span className="lm-chiffres font-medium">{euros(t.montantCentimes)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 pb-4 text-[13px] text-(--lm-encre-3) sm:px-5">Pas encore de tarif.</p>
        )}
      </Card>
      <Card>
        <CardHeader titre="Ajouter ou modifier un tarif" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Type de logement">
            <Select value={typeLogement} onChange={(e) => setTypeLogement(e.target.value as TypeLogement)} options={TYPES_LOGEMENT.map((t) => ({ valeur: t, libelle: LIBELLES.typeLogement[t] }))} />
          </Field>
          <Field label="Montant (€)" erreur={erreur}>
            <Input inputMode="decimal" value={montant} onChange={(e) => setMontant(e.target.value)} placeholder="45,00" />
          </Field>
        </div>
        <Button variant="primary" className="mt-3" onClick={enregistrer}>Enregistrer le tarif</Button>
      </Card>
    </div>
  );
}
