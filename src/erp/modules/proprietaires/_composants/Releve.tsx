import { useErp } from '../../../data/store';
import { LIBELLES } from '../../../data/libelles';
import { euros, jourMois, moisAnnee } from '../../../data/format';
import { releveProprietaire } from '../../../data/selectors';
import type { Proprietaire } from '../../../data/types';
import { SOCIETE } from '../../mandats/_composants/societe';

const th = 'px-3 py-2 text-[11.5px] font-medium tracking-wide text-(--lm-encre-2) uppercase whitespace-nowrap';
const td = 'px-3 py-2 whitespace-nowrap';

/** Relevé mensuel propriétaire (SPEC §2.7) : séjours au départ dans le mois. */
export function DocumentReleve({ proprietaire: p, periode }: { proprietaire: Proprietaire; periode: string }) {
  const d = useErp();
  const { lignes, totaux } = releveProprietaire(d, p.id, periode);
  return (
    <article className="bg-white text-(--lm-encre)">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-(--lm-or-anneau) pb-4">
        <div>
          <p className="lm-serif text-[19px] text-(--lm-brun)">{SOCIETE.nom}</p>
          <p className="text-[11.5px] text-(--lm-encre-2)">
            {SOCIETE.forme} · SIRET {SOCIETE.siret}
            <br />
            {SOCIETE.adresse}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11.5px] tracking-wide text-(--lm-encre-3) uppercase">Relevé de gestion</p>
          <p className="lm-serif text-[18px] capitalize">{moisAnnee(periode)}</p>
          <p className="text-[12.5px] font-medium">{p.nom}</p>
          <p className="text-[11.5px] text-(--lm-encre-2)">{p.adresse}</p>
        </div>
      </header>

      {lignes.length === 0 ? (
        <p className="py-8 text-center text-sm text-(--lm-encre-3)">Aucun départ sur la période : rien à reverser.</p>
      ) : (
        <div className="lm-defilement mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-[12.5px]">
            <thead>
              <tr className="border-b border-(--lm-bord) text-left">
                <th className={th}>Séjour</th>
                <th className={`${th} text-right`}>Brut</th>
                <th className={`${th} text-right`}>Plateforme</th>
                <th className={`${th} text-right`}>Ménage</th>
                <th className={`${th} text-right`}>Commission</th>
                <th className={`${th} text-right`}>Net</th>
              </tr>
            </thead>
            <tbody className="lm-chiffres">
              {lignes.map((l) => (
                <tr key={l.reservation.id} className="border-b border-(--lm-bord)">
                  <td className={td}>
                    <span className="font-medium">{l.logement.nom}</span>
                    <span className="block text-[11.5px] text-(--lm-encre-2)">
                      {l.reservation.voyageur.nom}, {LIBELLES.canal[l.reservation.canal]}, du {jourMois(l.reservation.arrivee)} au {jourMois(l.reservation.depart)} ({l.reservation.nuits} n.)
                    </span>
                  </td>
                  <td className={`${td} text-right`}>{euros(l.brut)}</td>
                  <td className={`${td} text-right text-(--lm-encre-2)`}>-{euros(l.commissionPlateforme)}</td>
                  <td className={`${td} text-right text-(--lm-encre-2)`}>-{euros(l.fraisMenage)}</td>
                  <td className={`${td} text-right text-(--lm-encre-2)`}>-{euros(l.commission)}</td>
                  <td className={`${td} text-right font-medium`}>{euros(l.net)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="lm-chiffres">
              <tr className="font-semibold">
                <td className={td}>Total ({lignes.length} séjour{lignes.length > 1 ? 's' : ''})</td>
                <td className={`${td} text-right`}>{euros(totaux.brut)}</td>
                <td className={`${td} text-right`}>-{euros(totaux.commissionPlateforme)}</td>
                <td className={`${td} text-right`}>-{euros(totaux.fraisMenage)}</td>
                <td className={`${td} text-right`}>-{euros(totaux.commission)}</td>
                <td className={`${td} text-right`}>{euros(totaux.net)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3 rounded-lg bg-(--lm-surface-2) px-4 py-3">
        <p className="text-[11.5px] text-(--lm-encre-2)">
          Virement sur {p.ibanMasque || 'IBAN à renseigner'}.
          <br />
          Séjours dont le départ a lieu en {moisAnnee(periode)}. Frais de ménage acquis au gestionnaire.
        </p>
        <p className="text-right">
          <span className="block text-[11.5px] tracking-wide text-(--lm-encre-3) uppercase">Montant reversé</span>
          <span className="lm-chiffres lm-serif text-[22px] text-(--lm-brun)">{euros(totaux.net)}</span>
        </p>
      </div>
    </article>
  );
}
