import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, FileCheck2, Lock, PauseCircle, Rocket } from 'lucide-react';
import { Alert, Badge, Button, Card, CardHeader, Input, ProgressBar, cn } from '../../../ui';
import { useErp } from '../../../data/store';
import { avancementChecklist, logementActivable, mandatDuLogement } from '../../../data/selectors';
import type { CleChecklistLancement, ElementChecklistLancement, Logement } from '../../../data/types';
import { completudeFiche } from '../_composants/stats';

/** Indication contextuelle par point, pour aider à rassembler la preuve. */
function indice(cle: CleChecklistLancement, l: Logement, mandatSigne: boolean): string | undefined {
  switch (cle) {
    case 'mandat_signe':
      return mandatSigne ? 'Mandat signé au référentiel.' : 'Le mandat n’est pas encore signé au référentiel.';
    case 'numero_enregistrement':
      return l.numeroEnregistrement ? `N° ${l.numeroEnregistrement}` : 'Aucun numéro saisi sur la fiche.';
    case 'dpe':
      return l.dpe ? `Classe ${l.dpe}` : 'Classe DPE non saisie.';
    case 'acces_securise':
      return l.serrure === 'cles' ? 'Remise de clés : non conforme, installer une serrure connectée ou une boîte à clés.' : undefined;
    case 'fiche_complete': {
      const c = completudeFiche(l.fiche);
      return c.manquants.length ? `Manque : ${c.manquants.join(', ')}.` : 'Fiche voyageur complète.';
    }
    case 'linge_etiquete':
      return l.dotationLinge.length ? `${l.dotationLinge.length} articles en dotation.` : 'Aucune dotation définie.';
    default:
      return undefined;
  }
}

function Point({ logement, element }: { logement: Logement; element: ElementChecklistLancement }) {
  const { cocherChecklistLancement, mandats } = useErp();
  const [preuve, setPreuve] = useState(element.preuve ?? '');
  const [erreur, setErreur] = useState<string>();
  const mandat = mandatDuLogement(mandats, logement.id);
  const aide = indice(element.cle, logement, mandat?.statut === 'signe');

  const basculer = () => {
    const r = cocherChecklistLancement(logement.id, element.cle, !element.fait, preuve.trim() || undefined);
    setErreur(r.ok ? undefined : r.erreur);
  };
  const enregistrerPreuve = () => {
    if ((element.preuve ?? '') === preuve.trim()) return;
    const r = cocherChecklistLancement(logement.id, element.cle, element.fait, preuve.trim());
    setErreur(r.ok ? undefined : r.erreur);
  };

  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:gap-4">
      <button
        type="button"
        role="checkbox"
        aria-checked={element.fait}
        onClick={basculer}
        className="flex min-w-0 flex-1 items-start gap-3 text-left"
      >
        <span
          aria-hidden
          className={cn(
            'mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border transition-colors',
            element.fait ? 'border-(--lm-succes) bg-(--lm-succes) text-white' : 'border-(--lm-bord-fort) bg-(--lm-surface)',
          )}
        >
          {element.fait && <Check className="size-3.5" strokeWidth={3} />}
        </span>
        <span className="min-w-0">
          <span className={cn('block text-[13.5px] font-medium', element.fait ? 'text-(--lm-encre-2)' : 'text-(--lm-encre)')}>{element.libelle}</span>
          {aide && <span className="mt-0.5 block text-[12px] text-(--lm-encre-3)">{aide}</span>}
          {erreur && <span role="alert" className="mt-0.5 block text-[12px] font-medium text-(--lm-danger)">{erreur}</span>}
        </span>
      </button>
      <div className="flex items-center gap-2 pl-8 sm:w-72 sm:pl-0">
        <FileCheck2 className={cn('size-4 shrink-0', element.preuve ? 'text-(--lm-succes)' : 'text-(--lm-encre-3)')} aria-hidden />
        <Input
          aria-label={`Preuve : ${element.libelle}`}
          placeholder="Preuve (lien, réf. document)"
          value={preuve}
          onChange={(e) => setPreuve(e.target.value)}
          onBlur={enregistrerPreuve}
          onKeyDown={(e) => e.key === 'Enter' && enregistrerPreuve()}
          className="h-8 text-[13px]"
        />
      </div>
    </li>
  );
}

export function OngletLancement({ logement: l }: { logement: Logement }) {
  const { mandats, activerLogement, upsert } = useErp();
  const [refus, setRefus] = useState<string>();
  const [succes, setSucces] = useState(false);
  const av = avancementChecklist(l);
  const verdict = logementActivable(l, mandats);
  const mandat = mandatDuLogement(mandats, l.id);

  const activer = () => {
    const r = activerLogement(l.id);
    setRefus(r.ok ? undefined : r.erreur);
    setSucces(r.ok);
  };

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <Card flush className="min-w-0 lg:col-span-2">
        <div className="p-4 sm:p-5">
          <CardHeader
            titre="Checklist de lancement"
            description="Bloquante : chaque point doit être validé, avec sa preuve, avant la mise en ligne."
            actions={<Badge tone={av.ratio === 1 ? 'succes' : 'alerte'}>{av.faits}/{av.total}</Badge>}
          />
          <ProgressBar valeur={av.ratio} afficherValeur label="Avancement" tone={av.ratio === 1 ? 'succes' : 'or'} />
        </div>
        <ul className="divide-y divide-(--lm-bord) border-t border-(--lm-bord)">
          {l.checklistLancement.map((c) => (
            <Point key={c.cle} logement={l} element={c} />
          ))}
        </ul>
      </Card>

      <div className="flex min-w-0 flex-col gap-5">
        <Card>
          <CardHeader titre="Activation" description="Règle : mandat signé ET checklist complète." />
          {l.statut === 'actif' ? (
            <>
              <Alert tone="succes" titre="Logement actif">Il est ouvert à la réservation sur ses canaux.</Alert>
              <Button className="mt-3 w-full" icone={<PauseCircle />} onClick={() => upsert('logements', { ...l, statut: 'pause' })}>
                Mettre en pause
              </Button>
            </>
          ) : l.statut === 'sorti' ? (
            <Alert tone="neutre" titre="Logement sorti du parc">Il ne peut plus être activé.</Alert>
          ) : (
            <>
              {verdict.ok ? (
                <Alert tone="succes" titre="Tous les prérequis sont réunis">Le logement peut être activé.</Alert>
              ) : (
                <Alert tone="alerte" icone={<Lock />} titre={`${verdict.raisons.length} blocage${verdict.raisons.length > 1 ? 's' : ''} avant activation`}>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4">
                    {verdict.raisons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </Alert>
              )}
              <Button variant="primary" icone={<Rocket />} className="mt-3 w-full" onClick={activer}>
                {l.statut === 'pause' ? 'Réactiver le logement' : 'Activer le logement'}
              </Button>
              {refus && (
                <Alert tone="danger" titre="Activation refusée" className="mt-3">
                  {verdict.ok ? refus : 'Levez les blocages listés ci-dessus : mandat signé et checklist complète sont obligatoires.'}
                </Alert>
              )}
            </>
          )}
          {succes && l.statut === 'actif' && <p className="mt-2 text-[12.5px] text-(--lm-succes)">Activation enregistrée au journal.</p>}
        </Card>
        <Card>
          <CardHeader titre="Mandat" />
          {mandat ? (
            <p className="text-[13.5px] text-(--lm-encre-2)">
              <Link to={`/erp/mandats?mandat=${mandat.id}`} className="font-medium text-(--lm-or) hover:underline">
                {mandat.reference}
              </Link>{' '}
              : {mandat.statut === 'signe' ? 'signé.' : 'non signé, le logement ne peut pas être activé.'}
            </p>
          ) : (
            <p className="text-[13.5px] text-(--lm-danger)">Aucun mandat : créez-le depuis l’écran Mandats.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
