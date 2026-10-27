/**
 * Factures d'un propriétaire, côté gérant : partager (ou ne plus partager)
 * chaque facture dans son espace propriétaire, joindre son PDF, la marquer
 * payée (date du paiement, aujourd'hui par défaut) ou annuler ce paiement.
 * Gérant seulement (comme les accès et les relances) ; les autres voient la
 * liste. Payée : ses relances s'arrêtent, le propriétaire voit « Payée le… ».
 *
 * Monté dans le panneau « Espace propriétaire » (fiche logement et
 * Paramètres → Accès), après « Bilans mensuels ». Les factures passent par le
 * store comme le reste de l'ERP ; une facture partagée et à payer entre dans
 * les relances (RelancesPaiement.tsx).
 */
import { useState } from 'react';
import { CheckCircle2, FileText, Share2, X } from 'lucide-react';
import { AUJOURDHUI, dateCourte, euros } from '../../../data/format';
import { nouvelId, useErp } from '../../../data/store';
import { annulerPaiementFacture, datePaiementValide, montantTtcFacture, partagerFacture, retirerPartageFacture, statutFactureVue } from '../../../data/relances';
import type { Facture, Proprietaire } from '../../../data/types';
import type { StatutFactureVue } from '../../../data/types-proprietaire';
import { Badge, Button, EnvoiFichier, IconButton, Input, LienFichier, type Ton } from '../../../ui';

const STATUT: Record<StatutFactureVue, { libelle: string; ton: Ton }> = {
  a_payer: { libelle: 'À payer', ton: 'neutre' },
  en_retard: { libelle: 'En retard', ton: 'alerte' },
  payee: { libelle: 'Payée', ton: 'succes' },
};

export function FacturesProprietaire({ proprietaire: p }: { proprietaire: Proprietaire }) {
  const d = useErp();
  const gerant = d.utilisateur.role === 'gerant' && !d.lectureSeule;
  // Factures adressées au propriétaire seulement (une facture voyageur ne se partage pas).
  const factures = d.donnees.factures
    .filter((f) => f.destinataire === 'proprietaire' && f.proprietaireId === p.id && f.statut !== 'brouillon' && f.statut !== 'annulee')
    .sort((a, b) => b.dateEmission.localeCompare(a.dateEmission));
  const pdfDe = (f: Facture) => d.donnees.documentsProprietaire.find((x) => x.factureId === f.id && x.proprietaireId === p.id);
  const maintenant = () => new Date().toISOString();
  // Facture dont on saisit le paiement (une à la fois), et sa date.
  const [paiement, setPaiement] = useState<{ id: string; date: string; erreur?: string }>();

  const payer = () => {
    if (!paiement) return;
    if (!datePaiementValide(paiement.date, AUJOURDHUI)) return setPaiement({ ...paiement, erreur: 'Choisissez la date du paiement (aujourd’hui au plus tard).' });
    const r = d.marquerFacturePayee(paiement.id, paiement.date);
    if (!r.ok) return setPaiement({ ...paiement, erreur: r.erreur });
    setPaiement(undefined);
  };

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
            const payee = f.statut === 'payee';
            const saisie = paiement?.id === f.id ? paiement : undefined;
            return (
              <li key={f.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
                <div className="min-w-48 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-[14px] font-medium text-(--lm-encre)">
                    {f.numero}
                    <Badge tone={s.ton}>{s.libelle}</Badge>
                  </p>
                  <p className="text-[12.5px] text-(--lm-encre-2)">
                    {euros(montantTtcFacture(f))} TTC · échéance {dateCourte(f.echeance)}
                    {payee && f.payeeLe ? ` · payée le ${dateCourte(f.payeeLe)}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {pdf ? (
                    <>
                      <LienFichier url={pdf.fichier} className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-[13px] font-medium text-(--lm-or-texte) hover:underline">
                        <FileText className="size-3.5" aria-hidden />
                        PDF
                      </LienFichier>
                      {gerant && (
                        <IconButton label={`Retirer le PDF de ${f.numero}`} size="sm" onClick={() => d.remove('documentsProprietaire', pdf.id)}>
                          <X />
                        </IconButton>
                      )}
                    </>
                  ) : (
                    gerant && (
                      <EnvoiFichier
                        dossier={`proprietaires/${p.id}`}
                        accept="application/pdf"
                        libelle="Joindre le PDF"
                        variant="ghost"
                        onEnvoye={(urls, fichiers) => joindre(f, urls, fichiers)}
                      />
                    )
                  )}
                  {gerant ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      icone={f.partageeLe ? undefined : <Share2 />}
                      onClick={() => d.upsert('factures', f.partageeLe ? retirerPartageFacture(f) : partagerFacture(f, maintenant()))}
                    >
                      {f.partageeLe ? 'Ne plus partager' : 'Partager'}
                    </Button>
                  ) : (
                    <span className="text-[13px] text-(--lm-encre-2)">{f.partageeLe ? 'Partagée' : 'Pas partagée'}</span>
                  )}
                  {gerant &&
                    (payee ? (
                      <Button size="sm" variant="ghost" onClick={() => d.upsert('factures', annulerPaiementFacture(f))}>
                        Annuler le paiement
                      </Button>
                    ) : (
                      !saisie && (
                        <Button size="sm" variant="ghost" icone={<CheckCircle2 />} onClick={() => setPaiement({ id: f.id, date: AUJOURDHUI })}>
                          Marquer payée
                        </Button>
                      )
                    ))}
                </div>
                {saisie && (
                  <div className="flex w-full flex-wrap items-center gap-2">
                    <label htmlFor={`paiement-${f.id}`} className="text-[13px] text-(--lm-encre)">
                      Payée le
                    </label>
                    <Input
                      id={`paiement-${f.id}`}
                      type="date"
                      max={AUJOURDHUI}
                      value={saisie.date}
                      onChange={(e) => setPaiement({ id: f.id, date: e.target.value })}
                      className="h-9 w-auto"
                    />
                    <Button size="sm" variant="secondary" onClick={payer}>
                      Enregistrer
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setPaiement(undefined)}>
                      Annuler
                    </Button>
                    {saisie.erreur && (
                      <p role="alert" className="w-full text-[12.5px] font-medium text-(--lm-danger)">
                        {saisie.erreur}
                      </p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
