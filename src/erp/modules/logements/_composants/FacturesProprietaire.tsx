/**
 * Factures d'un propriétaire, côté gérant : partager (ou ne plus partager)
 * chaque facture dans son espace propriétaire, joindre son PDF.
 *
 * Pas encore monté : à placer dans le panneau « Espace propriétaire » de la
 * fiche logement (après « Bilans mensuels »). Les factures passent par le
 * store comme le reste de l'ERP ; une facture partagée et à payer entre dans
 * les relances (RelancesPaiement.tsx).
 */
import { FileText, Share2, X } from 'lucide-react';
import { AUJOURDHUI, dateCourte, euros } from '../../../data/format';
import { nouvelId, useErp } from '../../../data/store';
import { montantTtcFacture, partagerFacture, retirerPartageFacture, statutFactureVue } from '../../../data/relances';
import type { Facture, Proprietaire } from '../../../data/types';
import type { StatutFactureVue } from '../../../data/types-proprietaire';
import { Badge, Button, EnvoiFichier, IconButton, LienFichier, type Ton } from '../../../ui';

const STATUT: Record<StatutFactureVue, { libelle: string; ton: Ton }> = {
  a_payer: { libelle: 'À payer', ton: 'neutre' },
  en_retard: { libelle: 'En retard', ton: 'alerte' },
  payee: { libelle: 'Payée', ton: 'succes' },
};

export function FacturesProprietaire({ proprietaire: p }: { proprietaire: Proprietaire }) {
  const d = useErp();
  const factures = d.donnees.factures
    .filter((f) => f.proprietaireId === p.id && f.statut !== 'brouillon' && f.statut !== 'annulee')
    .sort((a, b) => b.dateEmission.localeCompare(a.dateEmission));
  const pdfDe = (f: Facture) => d.donnees.documentsProprietaire.find((x) => x.factureId === f.id && x.proprietaireId === p.id);
  const maintenant = () => new Date().toISOString();

  const joindre = (f: Facture, urls: string[], fichiers: File[]) => {
    const url = urls[0];
    if (!url) return;
    d.upsert('documentsProprietaire', {
      id: nouvelId('docp'),
      proprietaireId: p.id,
      factureId: f.id,
      categorie: 'facture',
      titre: `Facture ${f.numero}`,
      fichier: url,
      nomFichier: fichiers[0]?.name ?? `${f.numero}.pdf`,
      ajouteLe: maintenant(),
      ajoutePar: d.utilisateur.email,
    });
  };

  return (
    <section>
      <div className="mb-3">
        <h3 className="text-[15px] font-semibold text-(--lm-encre)">Factures</h3>
        <p className="text-[13px] text-(--lm-encre-2)">Une facture partagée se voit dans son espace (avec son PDF) et, à payer, entre dans les relances.</p>
      </div>
      {!factures.length ? (
        <p className="text-[13.5px] text-(--lm-encre-2)">Aucune facture émise pour ce propriétaire.</p>
      ) : (
        <ul className="divide-y divide-(--lm-bord) rounded-xl border border-(--lm-bord)">
          {factures.map((f) => {
            const s = STATUT[statutFactureVue(f, AUJOURDHUI)];
            const pdf = pdfDe(f);
            return (
              <li key={f.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-[14px] font-medium text-(--lm-encre)">
                    {f.numero}
                    <Badge tone={s.ton}>{s.libelle}</Badge>
                    {f.partageeLe && <Badge tone="neutre">Partagée</Badge>}
                  </p>
                  <p className="text-[12.5px] text-(--lm-encre-2)">
                    {euros(montantTtcFacture(f))} TTC · échéance {dateCourte(f.echeance)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {pdf ? (
                    <>
                      <LienFichier url={pdf.fichier} className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-[13px] font-medium text-(--lm-or-texte) hover:underline">
                        <FileText className="size-3.5" aria-hidden />
                        PDF
                      </LienFichier>
                      <IconButton label={`Retirer le PDF de ${f.numero}`} size="sm" onClick={() => d.remove('documentsProprietaire', pdf.id)} disabled={d.lectureSeule}>
                        <X />
                      </IconButton>
                    </>
                  ) : (
                    <EnvoiFichier
                      dossier={`proprietaires/${p.id}`}
                      accept="application/pdf"
                      libelle="Joindre le PDF"
                      variant="ghost"
                      disabled={d.lectureSeule}
                      onEnvoye={(urls, fichiers) => joindre(f, urls, fichiers)}
                    />
                  )}
                  <Button
                    size="sm"
                    variant="secondary"
                    icone={f.partageeLe ? undefined : <Share2 />}
                    disabled={d.lectureSeule}
                    onClick={() => d.upsert('factures', f.partageeLe ? retirerPartageFacture(f) : partagerFacture(f, maintenant()))}
                  >
                    {f.partageeLe ? 'Ne plus partager' : 'Partager'}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
