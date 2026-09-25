import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { AUJOURDHUI, ajouterJours, dateJour, jourMois } from '../../../data/format';
import { useErp } from '../../../data/store';
import { Button, IconButton, TON_PLEIN, cn } from '../../../ui';
import { MissionCarte } from './MissionCarte';
import { lundi } from './outils';

const LEGENDE = [
  { libelle: 'Sans personne ou à vérifier', ton: 'alerte' },
  { libelle: 'Attribuée', ton: 'info' },
  { libelle: 'En cours', ton: 'or' },
  { libelle: 'Validée', ton: 'succes' },
  { libelle: 'Refusée', ton: 'danger' },
] as const;

/** Tableau de la semaine : un jour par colonne, une carte par mission. */
export function Planning() {
  const { missions, logements, prestataires } = useErp();
  const [decalage, setDecalage] = useState(0);
  const debut = ajouterJours(lundi(AUJOURDHUI), decalage * 7);
  const jours = Array.from({ length: 7 }, (_, i) => ajouterJours(debut, i));
  const total = missions.filter((m) => m.date >= debut && m.date < ajouterJours(debut, 7) && m.statut !== 'annulee').length;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <IconButton label="Semaine précédente" variant="secondary" size="sm" onClick={() => setDecalage((d) => d - 1)}>
          <ChevronLeft />
        </IconButton>
        <IconButton label="Semaine suivante" variant="secondary" size="sm" onClick={() => setDecalage((d) => d + 1)}>
          <ChevronRight />
        </IconButton>
        <p className="text-[14px] font-semibold text-(--lm-encre)">
          Semaine du {jourMois(debut)} au {jourMois(ajouterJours(debut, 6))}
        </p>
        <span className="lm-chiffres text-[13px] text-(--lm-encre-3)">{total} missions</span>
        {decalage !== 0 && (
          <Button size="sm" variant="ghost" onClick={() => setDecalage(0)}>
            Cette semaine
          </Button>
        )}
        <ul className="flex w-full flex-wrap gap-x-3 gap-y-1 text-[12px] text-(--lm-encre-2) lg:ml-auto lg:w-auto" aria-label="Légende des couleurs">
          {LEGENDE.map((l) => (
            <li key={l.libelle} className="inline-flex items-center gap-1.5">
              <span aria-hidden className={cn('size-2 rounded-full', TON_PLEIN[l.ton])} />
              {l.libelle}
            </li>
          ))}
        </ul>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {jours.map((jour) => {
          const duJour = missions
            .filter((m) => m.date === jour && m.statut !== 'annulee')
            .sort((a, b) => a.heureDebut.localeCompare(b.heureDebut));
          const estAujourdhui = jour === AUJOURDHUI;
          return (
            <section
              key={jour}
              aria-label={dateJour(jour)}
              className={cn(
                'flex min-h-32 flex-col rounded-xl border bg-(--lm-surface-2) p-2',
                estAujourdhui ? 'border-(--lm-or-anneau)' : 'border-(--lm-bord)',
              )}
            >
              <header className="mb-2 flex items-center justify-between px-1">
                <p className={cn('text-[12.5px] font-semibold first-letter:uppercase', estAujourdhui ? 'text-(--lm-or)' : 'text-(--lm-encre)')}>
                  {dateJour(jour)}
                  {estAujourdhui && <span className="sr-only"> (aujourd’hui)</span>}
                </p>
                <span className="lm-chiffres text-[12px] text-(--lm-encre-3)">{duJour.length}</span>
              </header>
              <div className="flex flex-col gap-1.5">
                {duJour.length === 0 && <p className="px-1 py-2 text-[12px] text-(--lm-encre-3)">Rien de prévu</p>}
                {duJour.map((m) => (
                  <MissionCarte
                    key={m.id}
                    mission={m}
                    logement={logements.find((l) => l.id === m.logementId)}
                    prestataire={prestataires.find((p) => p.id === m.prestataireId)}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
