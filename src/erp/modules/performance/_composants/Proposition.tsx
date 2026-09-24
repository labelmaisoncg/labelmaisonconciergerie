import { useMemo, useState } from 'react';
import { Printer, Send } from 'lucide-react';
import { AUJOURDHUI, dateJour, euros, nombre, pourcentage } from '../../../data/format';
import { useErp } from '../../../data/store';
import { Alert, Button, Field, Modal, Select } from '../../../ui';
import { useAnalyseParc } from './commun';
import { faireAvancer, LIBELLE_IMPACT, LIBELLE_PORTEUR } from './suivi';

/**
 * Proposition d'une page au propriétaire : constats chiffrés par bien et
 * améliorations retenues. Impression via window.print (seule la page
 * `.lm-imprimable` sort à l'impression).
 */
export function Proposition({ proprietaireInitial, onFermer }: { proprietaireInitial?: string; onFermer: () => void }) {
  const { proprietaires, recommandations, upsert } = useErp();
  const { lignes } = useAnalyseParc();
  const [proprietaireId, setProprietaireId] = useState(proprietaireInitial ?? '');
  const candidates = useMemo(
    () => recommandations.filter((r) => r.proprietaireId === proprietaireId && (r.statut === 'a_proposer' || r.statut === 'proposee')),
    [recommandations, proprietaireId],
  );
  const [coches, setCoches] = useState<Set<string> | null>(null);
  const choisies = candidates.filter((r) => (coches ? coches.has(r.id) : true));
  const p = proprietaires.find((x) => x.id === proprietaireId);
  const biens = lignes.filter((l) => l.proprietaireId === proprietaireId);
  const aProposer = choisies.filter((r) => r.statut === 'a_proposer');

  const basculer = (id: string) => {
    const s = new Set(coches ?? candidates.map((r) => r.id));
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setCoches(s);
  };
  const marquer = () => {
    for (const r of aProposer) upsert('recommandations', faireAvancer(r, 'proposee'));
  };

  return (
    <Modal
      ouvert
      onFermer={onFermer}
      taille="lg"
      titre="Proposition au propriétaire"
      description="Choisissez les améliorations à présenter, imprimez ou enregistrez en PDF, puis marquez-les comme proposées."
      pied={
        <>
          <Button variant="ghost" onClick={onFermer}>Fermer</Button>
          <Button icone={<Send />} disabled={!aProposer.length} onClick={marquer}>
            Marquer {aProposer.length || ''} comme proposée{aProposer.length > 1 ? 's' : ''}
          </Button>
          <Button variant="primary" icone={<Printer />} disabled={!choisies.length} onClick={() => window.print()}>
            Imprimer
          </Button>
        </>
      }
    >
      <style>{`@media print {
        body * { visibility: hidden !important; }
        .lm-imprimable, .lm-imprimable * { visibility: visible !important; }
        .lm-imprimable { position: fixed; inset: 0; padding: 16mm; background: #fff; overflow: visible; }
        @page { size: A4; margin: 0; }
      }`}</style>
      <div className="grid gap-4">
        <Field label="Propriétaire">
          <Select
            value={proprietaireId}
            onChange={(e) => { setProprietaireId(e.target.value); setCoches(null); }}
            placeholder="Choisir un propriétaire"
            options={proprietaires.map((x) => ({ valeur: x.id, libelle: x.nom }))}
          />
        </Field>
        {proprietaireId && !candidates.length && (
          <Alert tone="info">Aucune amélioration à proposer ou en cours de proposition pour ce propriétaire.</Alert>
        )}
        {candidates.length > 0 && (
          <fieldset className="grid gap-1.5">
            <legend className="mb-1 text-[13px] font-medium text-(--lm-encre)">Améliorations à inclure</legend>
            {candidates.map((r) => (
              <label key={r.id} className="flex items-start gap-2 text-[13.5px]">
                <input type="checkbox" className="mt-1 accent-(--lm-or)" checked={coches ? coches.has(r.id) : true} onChange={() => basculer(r.id)} />
                <span>{r.titre} <span className="text-(--lm-encre-3)">({r.statut === 'proposee' ? 'déjà proposée' : 'à proposer'})</span></span>
              </label>
            ))}
          </fieldset>
        )}

        {p && choisies.length > 0 && (
          <article className="lm-imprimable rounded-xl border border-(--lm-bord) bg-white p-5 text-[13px] text-(--lm-encre)">
            <header className="mb-4 flex items-start justify-between gap-4 border-b border-(--lm-or-anneau) pb-3">
              <div>
                <p className="lm-serif text-[20px]">Label Maison</p>
                <p className="text-[11.5px] text-(--lm-encre-2)">Conciergerie Airbnb en Essonne</p>
              </div>
              <p className="text-right text-[12px] text-(--lm-encre-2)">Le {dateJour(AUJOURDHUI)}<br />À l’attention de {p.nom}</p>
            </header>
            <h2 className="lm-serif mb-2 text-[18px]">Bilan et pistes d’amélioration</h2>
            {biens.map(({ analyse: a }) => (
              <section key={a.logement.id} className="mb-3">
                <h3 className="font-semibold">{a.logement.nom}</h3>
                <p className="text-(--lm-encre-2)">
                  Sur les 90 derniers jours : occupation {pourcentage(a.occupation90)}, prix moyen {euros(a.adr90, true)} la nuit, revenu brut {euros(a.f90.revenuBrut, true)}
                  {a.note12 !== undefined ? `, note ${nombre(a.note12, 2)} / 5 (${a.nbAvis12} avis)` : ''}.
                </p>
                {a.defauts.filter((d) => d.source !== 'finance' && d.source !== 'mandat').length > 0 && (
                  <p className="text-(--lm-encre-2)">
                    Constats : {a.defauts.filter((d) => d.source !== 'finance' && d.source !== 'mandat').map((d) => d.titre.toLowerCase()).join(', ')}.
                  </p>
                )}
              </section>
            ))}
            <table className="mt-2 w-full border-collapse text-[12.5px]">
              <thead>
                <tr className="border-b border-(--lm-bord-fort) text-left">
                  <th className="py-1.5 pr-2 font-semibold">Amélioration proposée</th>
                  <th className="py-1.5 pr-2 font-semibold">Porteur</th>
                  <th className="py-1.5 text-right font-semibold">Impact estimé</th>
                </tr>
              </thead>
              <tbody>
                {choisies.map((r) => (
                  <tr key={r.id} className="border-b border-(--lm-bord) align-top">
                    <td className="py-1.5 pr-2">
                      <span className="font-medium">{r.titre}</span>
                      <br />
                      <span className="text-(--lm-encre-2)">{r.detail}</span>
                    </td>
                    <td className="py-1.5 pr-2 whitespace-nowrap">{LIBELLE_PORTEUR[r.porteur]}</td>
                    <td className="lm-chiffres py-1.5 text-right whitespace-nowrap">
                      {r.impactEstimeCentimesMois !== undefined ? `+${euros(r.impactEstimeCentimesMois, true)} / mois` : 'Qualité'}
                      {r.impactSur && <><br /><span className="text-[11px] text-(--lm-encre-3)">{LIBELLE_IMPACT[r.impactSur]}</span></>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-[11.5px] text-(--lm-encre-3)">Estimations indicatives calculées sur l’historique du bien ; elles ne constituent pas une garantie de revenu.</p>
            <footer className="mt-6 flex items-end justify-between gap-4">
              <p className="text-[12px] text-(--lm-encre-2)">Bon pour accord, date et signature du propriétaire :<br /><br />........................................</p>
              <p className="text-right text-[12px]">
                <span className="font-semibold">Label Maison SASU</span>
                <br />
                Abdel et Kamel, associés
              </p>
            </footer>
          </article>
        )}
      </div>
    </Modal>
  );
}
