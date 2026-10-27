import { ChevronLeft, ChevronRight, Download, Printer, ReceiptText } from 'lucide-react';
import { dateCourte, euros, jourMois, nombre } from '../data/format';
import { documentDeFactureVue } from '../data/factures-mensuelles';
import type { FactureVue, StatutFactureVue, VueProprietaire } from '../data/types-proprietaire';
import { Badge, Button, Card, classesBouton, EmptyState, type Ton } from '../ui';
import { deNom, enteteImprime, titreMois, type LienDocument } from './commun';
import { DocumentFacture, FactureImprimable } from './DocumentFacture';

/** Statuts : à payer (neutre), en retard (alerte, jamais rouge), payée (succès). */
const STATUT: Record<StatutFactureVue, { libelle: string; ton: Ton }> = {
  a_payer: { libelle: 'À payer', ton: 'neutre' },
  en_retard: { libelle: 'En retard', ton: 'alerte' },
  payee: { libelle: 'Payée', ton: 'succes' },
};

function BadgeStatut({ f, court }: { f: FactureVue; court?: boolean }) {
  const s = STATUT[f.statut];
  return <Badge tone={s.ton}>{!court && f.statut === 'payee' && f.payeeLe ? `Payée le ${dateCourte(f.payeeLe)}` : s.libelle}</Badge>;
}

/**
 * Facture mensuelle (commission et ménages du mois) : la mise en page
 * complète, figée à sa validation, imprimée seule dans la charte « Ivoire & or ».
 */
function DetailFactureMensuelle({ f, espace, LienDocument, onRetour }: { f: FactureVue; espace: VueProprietaire['conciergerie']; LienDocument: LienDocument; onRetour: () => void }) {
  const doc = documentDeFactureVue(f)!;
  return (
    <>
      <button
        type="button"
        onClick={onRetour}
        className="lm-sans-impression -ml-2 mb-3 inline-flex h-9 items-center gap-1 rounded-lg px-2 text-[13.5px] font-medium text-(--lm-encre-2) hover:bg-(--lm-surface-2) hover:text-(--lm-encre) focus-visible:ring-2 focus-visible:ring-(--lm-or-anneau) focus:outline-none"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Toutes les factures
      </button>
      {/* Numéro, mois et échéance sont sur la facture elle-même : ici, l'état et l'action seulement. */}
      <h1 className="sr-only">
        Facture {f.numero}, {titreMois(doc.mois)}
      </h1>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <BadgeStatut f={f} />
        {f.pdf ? (
          <LienDocument id={f.pdf} className={classesBouton('primary', 'md')}>
            <Download className="size-4" aria-hidden />
            Télécharger le PDF
          </LienDocument>
        ) : (
          <Button variant="primary" icone={<Printer />} onClick={() => window.print()}>
            Imprimer ou enregistrer en PDF
          </Button>
        )}
      </div>
      <DocumentFacture doc={doc} />
      <FactureImprimable doc={doc} />
      {f.statut !== 'payee' && (
        <p className="mt-4 text-[14px] text-(--lm-encre-2)">
          Une question sur cette facture ? Contactez {espace.nom}.
          {f.dernierRappel && <span className="block text-[13px]">Rappel envoyé le {dateCourte(f.dernierRappel)}.</span>}
        </p>
      )}
    </>
  );
}

/** Une facture, telle qu'imprimée : lignes, totaux, comment la régler. */
function DetailFacture({ f, espace, LienDocument, onRetour }: { f: FactureVue; espace: VueProprietaire['conciergerie']; LienDocument: LienDocument; onRetour: () => void }) {
  const conciergerie = espace.nom;
  const tva = f.montantTtc - f.montantHt;
  if (f.mensuelle) return <DetailFactureMensuelle f={f} espace={espace} LienDocument={LienDocument} onRetour={onRetour} />;
  return (
    <>
      <button
        type="button"
        onClick={onRetour}
        className="lm-sans-impression -ml-2 mb-3 inline-flex h-9 items-center gap-1 rounded-lg px-2 text-[13.5px] font-medium text-(--lm-encre-2) hover:bg-(--lm-surface-2) hover:text-(--lm-encre) focus-visible:ring-2 focus-visible:ring-(--lm-or-anneau) focus:outline-none"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Toutes les factures
      </button>
      <article className="lm-bilan-imprimable" aria-label={`Facture ${f.numero}`}>
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="hidden text-[12px] text-(--lm-encre-2) print:block">{enteteImprime(espace)}</p>
            <h1 className="lm-serif text-[24px] leading-tight text-(--lm-brun)">Facture {f.numero}</h1>
            <p className="text-[13px] text-(--lm-encre-2)">
              Émise le {dateCourte(f.dateEmission)} · échéance le {dateCourte(f.echeance)}
            </p>
            <div className="mt-2">
              <BadgeStatut f={f} />
            </div>
          </div>
          {f.pdf ? (
            <LienDocument
              id={f.pdf}
              className={classesBouton('primary', 'md', 'lm-sans-impression')}
            >
              <Download className="size-4" aria-hidden />
              Télécharger le PDF
            </LienDocument>
          ) : (
            <Button variant="primary" icone={<Printer />} onClick={() => window.print()} className="lm-sans-impression">
              Imprimer ou enregistrer en PDF
            </Button>
          )}
        </header>

        <Card flush className="mt-4">
          <ul className="divide-y divide-(--lm-bord)">
            {f.lignes.map((l, i) => (
              <li key={i} className="flex items-baseline justify-between gap-3 px-4 py-3 text-[14px]">
                <span className="min-w-0 text-(--lm-encre)">
                  {l.libelle}
                  {l.quantite !== 1 && (
                    <span className="block text-[12.5px] text-(--lm-encre-2)">
                      {nombre(l.quantite)} × {euros(l.pu)}
                    </span>
                  )}
                </span>
                <span className="lm-chiffres shrink-0 text-(--lm-encre)">{euros(Math.round(l.quantite * l.pu))}</span>
              </li>
            ))}
          </ul>
          <dl className="border-t border-(--lm-bord) px-4 py-3 text-[14px]">
            <div className="flex justify-between py-1">
              <dt className="text-(--lm-encre-2)">Total HT</dt>
              <dd className="lm-chiffres">{euros(f.montantHt)}</dd>
            </div>
            <div className="flex justify-between py-1">
              <dt className="text-(--lm-encre-2)">TVA ({nombre(f.tvaPct, f.tvaPct % 1 ? 1 : 0)} %)</dt>
              <dd className="lm-chiffres">{euros(tva)}</dd>
            </div>
            <div className="mt-1 flex justify-between border-t border-(--lm-bord) pt-2.5">
              <dt className="font-semibold text-(--lm-encre)">Total TTC</dt>
              <dd className="lm-chiffres text-[17px] font-semibold text-(--lm-encre)">{euros(f.montantTtc)}</dd>
            </div>
          </dl>
        </Card>

        {f.statut !== 'payee' && (
          <p className="mt-4 text-[14px] text-(--lm-encre-2)">
            Pour la régler : un virement en indiquant « {f.numero} » en référence. Une question ? Contactez {conciergerie}.
            {f.dernierRappel && <span className="block text-[13px]">Rappel envoyé le {dateCourte(f.dernierRappel)}.</span>}
          </p>
        )}
      </article>
    </>
  );
}

/** Factures partagées par la conciergerie : à payer, en retard, payées. */
export function Factures({ vue, choisie, onChoisir, LienDocument }: { vue: VueProprietaire; choisie?: string; onChoisir: (id?: string) => void; LienDocument: LienDocument }) {
  const f = vue.factures.find((x) => x.id === choisie);
  if (f) return <DetailFacture f={f} espace={vue.conciergerie} LienDocument={LienDocument} onRetour={() => onChoisir(undefined)} />;
  const aRegler = vue.factures.filter((x) => x.statut !== 'payee');
  const total = aRegler.reduce((s, x) => s + x.montantTtc, 0);
  return (
    <>
      <p className="mb-4 text-[14px] text-(--lm-encre-2)">Les factures {deNom(vue.conciergerie.nom)} : montant, échéance et PDF.</p>
      {!vue.factures.length ? (
        <EmptyState icone={<ReceiptText />} titre="Aucune facture pour l’instant" description={`Les factures que ${vue.conciergerie.nom} partage avec vous apparaîtront ici.`} />
      ) : (
        <>
          {aRegler.length > 0 && (
            <p className="mb-3 text-[14px] text-(--lm-encre-2)">
              À régler : <span className="font-semibold text-(--lm-encre)">{euros(total)}</span>
            </p>
          )}
          <Card flush>
            <ul className="divide-y divide-(--lm-bord)">
              {vue.factures.map((x) => (
                <li key={x.id}>
                  <button
                    type="button"
                    onClick={() => onChoisir(x.id)}
                    className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left hover:bg-(--lm-surface-2) focus-visible:ring-2 focus-visible:ring-(--lm-or-anneau) focus:outline-none focus-visible:ring-inset"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-semibold text-(--lm-encre)">{x.numero}</span>
                      <span className="block text-[13px] text-(--lm-encre-2)">
                        {jourMois(x.dateEmission)} · échéance {jourMois(x.echeance)}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className="lm-chiffres text-[15px] font-semibold text-(--lm-encre)">{euros(x.montantTtc)}</span>
                      <BadgeStatut f={x} court />
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-(--lm-encre-3)" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </>
  );
}
