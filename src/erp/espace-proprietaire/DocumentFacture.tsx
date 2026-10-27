/**
 * La facture mensuelle telle qu'elle s'imprime : UNE seule mise en page,
 * partagée par le gérant (aperçu, validation, impression) et le propriétaire
 * (son espace). Pour l'ajuster à un modèle de facture, tout est ici.
 *
 * Mise en page française classique, charte « Ivoire & or » (fond ivoire,
 * filets or et champagne, titres en serif ; erp.css, .lm-facture) :
 *   1. en-tête : la conciergerie (raison sociale, forme, SIRET, adresse, n° de
 *      TVA) à gauche ; « Facture », numéro, date d'émission et échéance à droite ;
 *   2. « Facturé à » (propriétaire : nom, adresse) et « Objet » (gestion
 *      locative du mois, période, logements) ;
 *   3. lignes : désignation (et sa précision), quantité, prix unitaire HT,
 *      montant HT ;
 *   4. totaux : total HT, TVA (taux de l'espace) ou « TVA non applicable,
 *      art. 293 B du CGI », net à payer ;
 *   5. règlement (virement, numéro en référence, échéance), mentions libres
 *      de l'espace, ligne légale en pied.
 * Jamais de coordonnées bancaires.
 */
import type { ReactNode } from 'react';
import { euros, moisAnnee, nombre } from '../data/format';
import { intervalleDates, type DocumentFacture as Doc } from '../data/factures-mensuelles';
import { formaterSiret, ligneLegale } from '../data/identite-conciergerie';
import { dateTexte } from '../data/relances';
import { Imprimable } from '../modules/mandats/_composants/Imprimable';
import { cn } from '../ui';

const taux = (n: number) => `${nombre(n, n % 1 ? 1 : 0)} %`;

function Etiquette({ children }: { children: ReactNode }) {
  return <p className="mb-1 text-[11px] font-semibold tracking-[0.08em] text-(--lm-or-texte) uppercase">{children}</p>;
}

export function DocumentFacture({ doc, className }: { doc: Doc; className?: string }) {
  const e = doc.emetteur;
  const mois = moisAnnee(doc.mois);
  const franchise = !!doc.mentionTva;
  return (
    <article
      className={cn('lm-facture rounded-xl border border-(--lm-champagne) px-4 py-5 text-[13px] text-(--lm-encre) sm:px-8 sm:py-8', className)}
      aria-label={doc.brouillon ? `Brouillon de facture, ${mois}` : `Facture ${doc.numero}`}
    >
      <header className="lm-facture-bloc grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto] print:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <p className="lm-serif text-[20px] leading-tight text-(--lm-brun)">{e.raisonSociale}</p>
          <div className="mt-1 space-y-0.5 text-[12px] text-(--lm-encre-2)">
            {(e.forme || e.siret) && <p>{[e.forme, e.siret ? `SIRET ${formaterSiret(e.siret)}` : ''].filter(Boolean).join(' · ')}</p>}
            {e.adresse && <p>{e.adresse}</p>}
            {e.numeroTva && <p>N° de TVA intracommunautaire : {e.numeroTva}</p>}
          </div>
        </div>
        <div className="sm:text-right print:text-right">
          <p className="lm-serif text-[28px] leading-none text-(--lm-or-texte)">Facture</p>
          <p className="mt-2 text-[15px] font-semibold">{doc.brouillon ? 'Brouillon' : `N° ${doc.numero}`}</p>
          <dl className="mt-1 space-y-0.5 text-[12px] text-(--lm-encre-2)">
            <div>
              <dt className="inline">{doc.brouillon ? 'Numéro et date : ' : 'Émise le '}</dt>
              <dd className="inline">{doc.brouillon ? 'à la validation' : dateTexte(doc.dateEmission)}</dd>
            </div>
            {!doc.brouillon && (
              <div>
                <dt className="inline">Échéance : </dt>
                <dd className="inline font-medium text-(--lm-encre)">{dateTexte(doc.echeance)}</dd>
              </div>
            )}
          </dl>
        </div>
      </header>

      <div className="mt-5 h-0.5 bg-(--lm-or)" aria-hidden />

      <section className="lm-facture-bloc mt-5 grid gap-5 sm:grid-cols-2 print:grid-cols-2">
        <div className="min-w-0">
          <Etiquette>Facturé à</Etiquette>
          <p className="font-semibold">{doc.client.nom || 'Propriétaire'}</p>
          {doc.client.adresse ? <p className="text-(--lm-encre-2)">{doc.client.adresse}</p> : <p className="text-(--lm-encre-2) italic">Adresse à compléter</p>}
        </div>
        <div className="min-w-0">
          <Etiquette>Objet</Etiquette>
          <p className="font-semibold">Gestion locative · {mois}</p>
          <p className="text-(--lm-encre-2)">Période {intervalleDates(doc.periode.du, doc.periode.au, { long: true, annee: true })}</p>
          {doc.logements.length > 0 && (
            <p className="text-(--lm-encre-2)">
              {doc.logements.length > 1 ? 'Logements' : 'Logement'} : {doc.logements.join(', ')}
            </p>
          )}
        </div>
      </section>

      <table className="mt-6 w-full border-collapse text-left">
        <caption className="sr-only">Détail de la facture</caption>
        <thead>
          <tr className="border-b border-(--lm-champagne) text-[11px] tracking-[0.06em] text-(--lm-or-texte) uppercase">
            <th scope="col" className="py-2 pr-3 font-semibold">
              Désignation
            </th>
            <th scope="col" className="hidden py-2 pr-3 text-right font-semibold sm:table-cell print:table-cell">
              Qté
            </th>
            <th scope="col" className="hidden py-2 pr-3 text-right font-semibold whitespace-nowrap sm:table-cell print:table-cell">
              Prix unit. HT
            </th>
            <th scope="col" className="py-2 text-right font-semibold whitespace-nowrap">
              Montant HT
            </th>
          </tr>
        </thead>
        <tbody>
          {doc.lignes.map((l, i) => (
            <tr key={i} className="border-b border-(--lm-champagne)/60 align-top">
              <td className="py-2.5 pr-3 print:py-1.5">
                <span className="block font-medium">{l.libelle}</span>
                {l.detail && <span className="block text-[12px] text-(--lm-encre-2)">{l.code === 'ajustement' ? `Raison : ${l.detail}` : l.detail}</span>}
              </td>
              <td className="lm-chiffres hidden py-2.5 pr-3 text-right sm:table-cell print:table-cell print:py-1.5">{nombre(l.quantite)}</td>
              <td className="lm-chiffres hidden py-2.5 pr-3 text-right whitespace-nowrap sm:table-cell print:table-cell print:py-1.5">{euros(l.pu)}</td>
              <td className="lm-chiffres py-2.5 text-right whitespace-nowrap print:py-1.5">{euros(l.montant)}</td>
            </tr>
          ))}
          {!doc.lignes.length && (
            <tr>
              <td colSpan={4} className="py-3 text-(--lm-encre-2)">
                Rien à facturer ce mois-ci.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="lm-facture-bloc mt-4 flex justify-end">
        <dl className="w-full max-w-72 text-[13px]">
          <div className="flex justify-between gap-4 py-1">
            <dt className="text-(--lm-encre-2)">Total HT</dt>
            <dd className="lm-chiffres">{euros(doc.totalHt)}</dd>
          </div>
          {franchise ? (
            <p className="py-1 text-right text-[12px] text-(--lm-encre-2)">{doc.mentionTva}</p>
          ) : (
            <div className="flex justify-between gap-4 py-1">
              <dt className="text-(--lm-encre-2)">TVA ({taux(doc.tvaPct)})</dt>
              <dd className="lm-chiffres">{euros(doc.tva)}</dd>
            </div>
          )}
          <div className="mt-1 flex items-baseline justify-between gap-4 border-t-2 border-(--lm-or) pt-2">
            <dt className="font-semibold">{franchise ? 'Net à payer' : 'Total TTC'}</dt>
            <dd className="lm-chiffres text-[17px] font-semibold text-(--lm-brun)">{euros(doc.totalTtc)}</dd>
          </div>
        </dl>
      </div>

      <section className="lm-facture-bloc mt-6 space-y-2 text-[12px] text-(--lm-encre-2)">
        <p>
          Règlement par virement sur le compte indiqué dans votre mandat de gestion{doc.brouillon ? '' : `, au plus tard le ${dateTexte(doc.echeance)}`}, en indiquant {doc.brouillon ? 'le numéro de la facture' : `« ${doc.numero} »`} en référence.
        </p>
        {e.mentions && <p className="whitespace-pre-line">{e.mentions}</p>}
      </section>

      <footer className="mt-6 border-t border-(--lm-champagne) pt-3 text-center text-[11px] text-(--lm-encre-2)">{ligneLegale(e)}</footer>
    </article>
  );
}

/**
 * La facture, prête pour « Imprimer ou enregistrer en PDF » : rendue hors de
 * l'application (Imprimable), seule sur la feuille, fond ivoire bord à bord.
 */
export function FactureImprimable({ doc }: { doc: Doc }) {
  return (
    <Imprimable>
      {/* Feuille sans marge (la marge est dans la facture, erp.css) : déclarée ici, APRÈS la règle
          @page d'Imprimable, sinon Chrome garde les marges de celle-ci. */}
      <style>{'@media print { @page facture { margin: 0; } }'}</style>
      <DocumentFacture doc={doc} />
    </Imprimable>
  );
}
