import { AUJOURDHUI, dateCourte, euros, jourMois, moisAnnee, nombre } from '../../../data/format';
import { LIBELLES } from '../../../data/libelles';
import { mandatDuLogement, type releveProprietaire } from '../../../data/selectors';
import type { Logement, Mandat, Proprietaire } from '../../../data/types';
import { ENTREPRISE, ENTREPRISE_LIGNE } from './entreprise';

type Releve = ReturnType<typeof releveProprietaire>;

interface Props {
  proprietaire: Proprietaire;
  periode: string;
  releve: Releve;
  logements: Logement[];
  mandats: Mandat[];
}

const TH = 'px-2.5 py-2 text-[11.5px] font-medium text-(--lm-encre-2) whitespace-nowrap';
const TD = 'px-2.5 py-2 whitespace-nowrap';
const moins = (c: number) => (c ? `- ${euros(c)}` : euros(0));

/** Relevé mensuel imprimable (SPEC §2.7). Seul ce bloc est imprimé. */
export function DocumentReleve({ proprietaire, periode, releve, logements, mandats }: Props) {
  const { totaux } = releve;
  const siens = logements.filter((l) => l.proprietaireId === proprietaire.id);
  return (
    <article className="lm-releve-print rounded-xl border border-(--lm-bord) bg-(--lm-surface) p-4 shadow-(--lm-ombre) sm:p-6" aria-label="Relevé propriétaire">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-(--lm-bord) pb-4">
        <div>
          <p className="lm-serif text-[20px] text-(--lm-brun)">{ENTREPRISE.raisonSociale}</p>
          <p className="text-[12px] text-(--lm-encre-2)">
            {ENTREPRISE.forme} · SIRET {ENTREPRISE.siret}
            <br />
            {ENTREPRISE.adresse}, {ENTREPRISE.ville}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[12px] tracking-wide text-(--lm-encre-3) uppercase">Relevé de gestion</p>
          <p className="lm-serif text-[20px] capitalize">{moisAnnee(periode)}</p>
          <p className="text-[12px] text-(--lm-encre-2)">Édité le {dateCourte(AUJOURDHUI)}</p>
        </div>
      </header>

      <div className="grid gap-3 py-4 text-[13px] sm:grid-cols-2">
        <div>
          <p className="text-[12px] text-(--lm-encre-3)">Propriétaire</p>
          <p className="font-semibold">{proprietaire.nom}</p>
          <p className="text-(--lm-encre-2)">{proprietaire.adresse}</p>
        </div>
        <div>
          <p className="text-[12px] text-(--lm-encre-3)">Logements et conditions du mandat</p>
          {siens.map((l) => {
            const m = mandatDuLogement(mandats, l.id);
            return (
              <p key={l.id} className="text-(--lm-encre-2)">
                <span className="text-(--lm-encre)">{l.nom}</span>
                {m && ` · commission ${nombre(m.commissionPct)} % · ménage ${euros(m.fraisMenageCentimes)} (mandat ${m.reference})`}
              </p>
            );
          })}
        </div>
      </div>

      <div className="lm-defilement overflow-x-auto rounded-lg border border-(--lm-bord)">
        <table className="w-full border-collapse text-[12.5px]">
          <caption className="sr-only">Séjours terminés en {moisAnnee(periode)}</caption>
          <thead className="bg-(--lm-surface-2) text-left">
            <tr>
              <th scope="col" className={TH}>Séjour</th>
              <th scope="col" className={`${TH} text-right`}>Payé voyageur</th>
              <th scope="col" className={`${TH} text-right`}>Comm. plateforme</th>
              <th scope="col" className={`${TH} text-right`}>Frais de ménage</th>
              <th scope="col" className={`${TH} text-right`}>Commission Label Maison</th>
              <th scope="col" className={`${TH} text-right`}>Net propriétaire</th>
            </tr>
          </thead>
          <tbody className="lm-chiffres">
            {releve.lignes.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-(--lm-encre-3)">Aucun séjour terminé sur la période.</td>
              </tr>
            )}
            {releve.lignes.map((l) => (
              <tr key={l.reservation.id} className="border-t border-(--lm-bord)">
                <td className={TD}>
                  <span className="font-medium">{l.reservation.voyageur.nom}</span>
                  <span className="block text-[11.5px] text-(--lm-encre-3)">
                    {jourMois(l.reservation.arrivee)} au {jourMois(l.reservation.depart)} · {l.reservation.nuits} n. · {LIBELLES.canal[l.reservation.canal]}
                    {siens.length > 1 && <> · {l.logement.nom}</>}
                  </span>
                </td>
                <td className={`${TD} text-right`}>{euros(l.brut)}</td>
                <td className={`${TD} text-right`}>{moins(l.commissionPlateforme)}</td>
                <td className={`${TD} text-right`}>{moins(l.fraisMenage)}</td>
                <td className={`${TD} text-right`}>{moins(l.commission)}</td>
                <td className={`${TD} text-right font-semibold`}>{euros(l.net)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="lm-chiffres border-t-2 border-(--lm-bord-fort) bg-(--lm-surface-2) font-semibold">
            <tr>
              <th scope="row" className={`${TD} text-left`}>Total {moisAnnee(periode)}</th>
              <td className={`${TD} text-right`}>{euros(totaux.brut)}</td>
              <td className={`${TD} text-right`}>{moins(totaux.commissionPlateforme)}</td>
              <td className={`${TD} text-right`}>{moins(totaux.fraisMenage)}</td>
              <td className={`${TD} text-right`}>{moins(totaux.commission)}</td>
              <td className={`${TD} text-right`}>{euros(totaux.net)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_260px]">
        <p className="text-[12px] leading-relaxed text-(--lm-encre-2)">
          Net propriétaire = montant payé par le voyageur - commission de la plateforme - frais de ménage - commission de gestion Label Maison.
          La commission de gestion s’applique au montant hors commission plateforme et hors frais de ménage. Les frais de ménage rémunèrent
          l’intervention après chaque départ.
        </p>
        <div className="rounded-lg border border-(--lm-or-anneau) bg-(--lm-or-lavis) p-3">
          <p className="text-[12px] text-(--lm-brun)">Net versé au propriétaire</p>
          <p className="lm-chiffres text-[24px] font-semibold text-(--lm-encre)">{euros(totaux.net)}</p>
          <p className="text-[11.5px] text-(--lm-encre-2)">Virement sur le compte {proprietaire.ibanMasque}</p>
        </div>
      </div>

      <footer className="mt-5 border-t border-(--lm-bord) pt-3 text-[11px] text-(--lm-encre-3)">{ENTREPRISE_LIGNE}</footer>
    </article>
  );
}
