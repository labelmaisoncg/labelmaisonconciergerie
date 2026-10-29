import { ChevronRight, FileText, FolderOpen } from 'lucide-react';
import { dateCourte } from '../data/format';
import { CATEGORIES_DOCUMENT } from '../data/proprietaire';
import type { VueProprietaire } from '../data/types-proprietaire';
import { Card, EmptyState } from '../ui';
import { TitreEspace, type LienDocument } from './commun';

/** Documents partagés par la conciergerie, rangés par catégorie. */
export function Documents({ vue, LienDocument }: { vue: VueProprietaire; LienDocument: LienDocument }) {
  const nomLogement = (id?: string) => (id && vue.logements.length > 1 ? vue.logements.find((l) => l.id === id)?.nom : undefined);
  const groupes = CATEGORIES_DOCUMENT.map((c) => ({ ...c, documents: vue.documents.filter((d) => d.categorie === c.valeur) })).filter((g) => g.documents.length);
  return (
    <>
      <TitreEspace titre="Documents" description={`Contrats, attestations et autres documents partagés par ${vue.conciergerie.nom}. Touchez un document pour l’ouvrir.`} />
      {!groupes.length ? (
        <EmptyState icone={<FolderOpen />} titre="Aucun document pour l’instant" description={`Les documents que ${vue.conciergerie.nom} partage avec vous apparaîtront ici.`} />
      ) : (
        <div className="space-y-6">
          {groupes.map((g) => (
            <section key={g.valeur}>
              <h2 className="mb-2 text-[13px] font-semibold tracking-wide text-(--lm-encre-2) uppercase">{g.libelle}</h2>
              <Card flush>
                <ul className="divide-y divide-(--lm-bord)">
                  {g.documents.map((d) => {
                    const logement = nomLogement(d.logementId);
                    return (
                      <li key={d.id}>
                        <LienDocument id={d.id} className="flex min-h-14 items-center gap-3 px-4 py-2.5 hover:bg-(--lm-surface-2)">
                          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-(--lm-surface-2) text-(--lm-encre)" aria-hidden>
                            <FileText className="size-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[14px] font-medium text-(--lm-encre)">{d.titre}</span>
                            <span className="block truncate text-[12.5px] text-(--lm-encre-2)">
                              Ajouté le {dateCourte(d.ajouteLe.slice(0, 10))}
                              {logement ? ` · ${logement}` : ''}
                            </span>
                          </span>
                          <ChevronRight className="size-4 shrink-0 text-(--lm-encre-3)" aria-hidden />
                        </LienDocument>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
