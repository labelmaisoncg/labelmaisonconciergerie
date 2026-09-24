import { useState } from 'react';
import { CheckCircle2, Printer, Send } from 'lucide-react';
import { useErp } from '../../../data/store';
import { AUJOURDHUI, dateCourte, euros, nombre, pluriel } from '../../../data/format';
import { LIBELLES } from '../../../data/libelles';
import { montantTtc } from '../../../data/selectors';
import type { Facture } from '../../../data/types';
import { Alert, Button, Drawer, StatusBadge } from '../../../ui';
import { joursRetard, statutReel } from '../_calculs';
import { ENTREPRISE_LIGNE } from './entreprise';

interface Props {
  facture: Facture;
  destinataire: string;
  onFermer: () => void;
}

export function DetailFacture({ facture: f, destinataire, onFermer }: Props) {
  const { marquerFacturePayee, upsert } = useErp();
  const [erreur, setErreur] = useState<string>();
  const statut = statutReel(f);
  const tva = montantTtc(f) - f.montantHtCentimes;

  const payer = () => {
    const r = marquerFacturePayee(f.id, AUJOURDHUI);
    setErreur(r.ok ? undefined : r.erreur);
  };
  const emettre = () => {
    if (!f.lignes.length) return setErreur('Impossible d’émettre : la facture n’a aucune ligne.');
    upsert('factures', { ...f, statut: 'emise', dateEmission: AUJOURDHUI });
    setErreur(undefined);
  };

  return (
    <Drawer
      ouvert
      onFermer={onFermer}
      titre={`Facture ${f.numero}`}
      sousTitre={
        <span className="flex flex-wrap items-center gap-2">
          <StatusBadge type="statutFacture" valeur={statut} />
          {LIBELLES.typeFacture[f.type]} · {destinataire}
        </span>
      }
      pied={
        <>
          <Button icone={<Printer />} onClick={() => window.print()}>
            Imprimer
          </Button>
          {f.statut === 'brouillon' && (
            <Button variant="primary" icone={<Send />} onClick={emettre}>
              Émettre la facture
            </Button>
          )}
          {(f.statut === 'emise' || f.statut === 'en_retard') && (
            <Button variant="primary" icone={<CheckCircle2 />} onClick={payer}>
              Marquer payée
            </Button>
          )}
        </>
      }
    >
      {erreur && (
        <Alert tone="danger" className="mb-4" titre="Action impossible">
          {erreur}
        </Alert>
      )}
      {statut === 'en_retard' && (
        <Alert tone="danger" className="mb-4" titre={`${pluriel(joursRetard(f), 'jour')} de retard`}>
          Échéance dépassée depuis le {dateCourte(f.echeance)}. Relancer {destinataire}.
        </Alert>
      )}

      <dl className="mb-5 grid grid-cols-2 gap-3 text-[13px]">
        <Info libelle="Destinataire" valeur={destinataire} />
        <Info libelle="Type" valeur={LIBELLES.typeFacture[f.type]} />
        <Info libelle="Émise le" valeur={dateCourte(f.dateEmission)} />
        <Info libelle="Échéance" valeur={dateCourte(f.echeance)} />
        {f.payeeLe && <Info libelle="Payée le" valeur={dateCourte(f.payeeLe)} />}
      </dl>

      <div className="lm-defilement overflow-x-auto rounded-lg border border-(--lm-bord)">
        <table className="w-full text-[13px]">
          <caption className="sr-only">Lignes de la facture</caption>
          <thead className="bg-(--lm-surface-2) text-left text-[12px] text-(--lm-encre-2)">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">Désignation</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Qté</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">PU HT</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Total HT</th>
            </tr>
          </thead>
          <tbody className="lm-chiffres">
            {f.lignes.map((l, i) => (
              <tr key={i} className="border-t border-(--lm-bord)">
                <td className="px-3 py-2">{l.libelle}</td>
                <td className="px-3 py-2 text-right">{nombre(l.quantite)}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">{euros(l.puCentimes)}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">{euros(l.quantite * l.puCentimes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="lm-chiffres mt-4 ml-auto max-w-xs space-y-1 text-[13.5px]">
        <Total libelle="Total HT" valeur={euros(f.montantHtCentimes)} />
        <Total libelle={`TVA ${nombre(f.tvaPct)} %`} valeur={euros(tva)} />
        <Total libelle="Total TTC" valeur={euros(montantTtc(f))} fort />
      </dl>

      <p className="mt-6 text-[11.5px] text-(--lm-encre-3)">{ENTREPRISE_LIGNE}</p>
    </Drawer>
  );
}

function Info({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <div>
      <dt className="text-[12px] text-(--lm-encre-3)">{libelle}</dt>
      <dd className="font-medium">{valeur}</dd>
    </div>
  );
}

function Total({ libelle, valeur, fort }: { libelle: string; valeur: string; fort?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 ${fort ? 'border-t border-(--lm-bord-fort) pt-1.5 text-[15px] font-semibold' : 'text-(--lm-encre-2)'}`}>
      <dt>{libelle}</dt>
      <dd className="text-(--lm-encre)">{valeur}</dd>
    </div>
  );
}
