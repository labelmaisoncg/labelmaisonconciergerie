import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Rocket } from 'lucide-react';
import { useErp } from '../../data/store';
import { Alert, Button, Card, PageHeader, cn } from '../../ui';
import { Onglets } from './_composants/Onglets';
import { EtapeChecklist, EtapeMandat } from './_composants/lancement/EtapesMandat';
import { EtapeLogement, EtapeProprietaire } from './_composants/lancement/EtapesReferentiel';
import { brouillonInitial, construire, validerEtape, type BrouillonLancement, type Erreurs } from './_composants/lancement/etat';

const ETAPES = [
  { titre: 'Propriétaire', description: 'Qui nous confie le bien.' },
  { titre: 'Logement', description: 'Les informations de base du bien.' },
  { titre: 'Mandat', description: 'Conditions de gestion.' },
  { titre: 'Checklist de lancement', description: 'Ce qui bloque l’activation.' },
];

export default function Lancement() {
  const d = useErp();
  const naviguer = useNavigate();
  const [params] = useSearchParams();
  const prospectInitial = d.prospects.find((p) => p.id === params.get('prospect'));
  const [b, setB] = useState<BrouillonLancement>(() => brouillonInitial(prospectInitial));
  const [etape, setEtape] = useState(0);
  const [erreurs, setErreurs] = useState<Erreurs>({});
  const [echec, setEchec] = useState<string>();

  const maj = <K extends keyof BrouillonLancement>(k: K, v: BrouillonLancement[K]) => {
    if (k === 'prospectId') {
      // Changer de prospect pré-remplit à nouveau le brouillon.
      const p = d.prospects.find((x) => x.id === v);
      setB({ ...brouillonInitial(p), prospectId: String(v) });
    } else setB((x) => ({ ...x, [k]: v }));
    if (erreurs[k]) setErreurs((e) => ({ ...e, [k]: undefined }));
  };

  const suivant = () => {
    const e = validerEtape(etape, b);
    setErreurs(e);
    if (Object.keys(e).length) return;
    setEtape((x) => x + 1);
    window.scrollTo?.({ top: 0 });
  };

  const terminer = () => {
    const e = validerEtape(3, b);
    setErreurs(e);
    if (Object.keys(e).length) return;
    const prospect = d.prospects.find((p) => p.id === b.prospectId);
    const { proprietaire, logement, mandat } = construire(b, d.mandats, prospect);
    if (proprietaire) d.upsert('proprietaires', proprietaire);
    d.upsert('logements', logement);
    d.upsert('mandats', mandat);
    if (prospect) {
      const r = d.avancerProspect(prospect.id, 'signe');
      if (!r.ok) setEchec(r.erreur);
    }
    naviguer(`/erp/logements/${logement.id}`);
  };

  const Contenu = [EtapeProprietaire, EtapeLogement, EtapeMandat, EtapeChecklist][etape];

  return (
    <>
      <PageHeader
        fil={[{ libelle: 'Prospection', to: '/erp/commercial' }, { libelle: 'Contrat signé' }]}
        titre="Un propriétaire a signé"
        sousTitre="On enregistre le propriétaire, son logement et son contrat en une fois. Ensuite, une liste d’étapes vous guide jusqu’à la mise en ligne."
      />
      <Onglets />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <nav aria-label="Étapes du lancement">
          <ol className="flex gap-2 overflow-x-auto lg:flex-col lm-defilement">
            {ETAPES.map((s, i) => (
              <li key={s.titre} className="shrink-0 lg:shrink">
                <button
                  type="button"
                  disabled={i > etape}
                  onClick={() => setEtape(i)}
                  aria-current={i === etape ? 'step' : undefined}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] disabled:cursor-default',
                    i === etape ? 'bg-(--lm-or-lavis) font-semibold text-(--lm-encre)' : 'text-(--lm-encre-2) hover:enabled:bg-(--lm-neutre-lavis)',
                  )}
                >
                  <span aria-hidden className={cn('lm-chiffres grid size-6 shrink-0 place-items-center rounded-full text-[12px] font-semibold',
                    i < etape ? 'bg-(--lm-succes) text-white' : i === etape ? 'bg-(--lm-or) text-white' : 'bg-(--lm-neutre-lavis)')}>
                    {i < etape ? <Check className="size-3.5" /> : i + 1}
                  </span>
                  <span className="whitespace-nowrap lg:whitespace-normal">{s.titre}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <Card>
          <div className="mb-4">
            <p className="text-[12px] text-(--lm-encre-3)">Étape {etape + 1} sur {ETAPES.length}</p>
            <h2 className="lm-serif text-[20px] text-(--lm-encre)">{ETAPES[etape].titre}</h2>
            <p className="text-[13px] text-(--lm-encre-2)">{ETAPES[etape].description}</p>
          </div>
          {Object.values(erreurs).some(Boolean) && (
            <Alert tone="danger" className="mb-4" titre="Quelques champs sont à corriger">
              Vérifiez les champs signalés en rouge avant de continuer.
            </Alert>
          )}
          {echec && <Alert tone="danger" className="mb-4">{echec}</Alert>}
          <Contenu b={b} maj={maj} erreurs={erreurs} />
          <div className="mt-6 flex flex-wrap justify-between gap-2 border-t border-(--lm-bord) pt-4">
            <Button variant="ghost" icone={<ArrowLeft />} onClick={() => (etape ? setEtape(etape - 1) : naviguer('/erp/commercial'))}>
              {etape ? 'Précédent' : 'Retour au pipeline'}
            </Button>
            {etape < ETAPES.length - 1 ? (
              <Button variant="primary" iconeFin={<ArrowRight />} onClick={suivant}>
                Continuer
              </Button>
            ) : (
              <Button variant="primary" icone={<Rocket />} onClick={terminer}>
                Créer le lancement
              </Button>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
