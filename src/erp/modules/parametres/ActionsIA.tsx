/**
 * Paramètres → Actions de l'IA (gérant) : ce que Claude (connecteur) et votre
 * agent (messagerie) ont fait dans l'ERP ces 90 derniers jours, en clair, du
 * plus récent au plus ancien, avec « Annuler » quand c'est possible.
 *
 * - En haut, les réponses proposées qui attendent l'équipe : rien n'est parti,
 *   elles s'envoient depuis la Messagerie (la confirmation), ou se retirent.
 * - « Annuler » relit la cible dans la base : si elle a changé depuis
 *   l'action, rien n'est écrasé et la raison s'affiche.
 * - Un message envoyé ne se reprend pas ; aucun prix, aucun paiement.
 *
 * Règles : src/erp/data/copilote.ts. Collection réservée aux gérants par la
 * base (supabase/erp-espaces.sql).
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bot, MessageSquareText, Sparkles } from 'lucide-react';
import { ACTIONS_POSSIBLES, LIBELLE_SOURCE, actionsVisibles, annulerAction, etatAffiche, type ActionAgent, type EtatAffiche } from '../../data/copilote';
import { espaceOuvert } from '../../data/espaces';
import { AUJOURDHUI, heure, horodatageMaintenant, pluriel } from '../../data/format';
import { useErp } from '../../data/store';
import { Aide, Alert, Badge, Button, ButtonLink, Card, CardHeader, EmptyState, Modal, Segmente, cn } from '../../ui';
import { titreJour } from '../messagerie/_composants/logique';

type Source = 'tout' | 'claude' | 'agent';

/** Lien d'une trace : une page de l'ERP seulement (la trace vient de la base). */
const lienSur = (l: string | undefined): string | undefined => (l && /^\/erp\/[\w\-/?=%.&]*$/.test(l) ? l : undefined);

/** Ce qui reviendra comme avant, dit simplement (fenêtre de confirmation). */
function ceQuiRevient(a: ActionAgent): string[] {
  const r = a.retour;
  if (!r) return [];
  if (r.genre === 'proposition') return ['La réponse proposée est retirée de la conversation. Rien n’avait été envoyé au voyageur.'];
  if (r.genre === 'supprimer') {
    if (a.collection === 'missions') return ['Le ménage est retiré du planning.'];
    if (a.collection === 'factures') return ['Le brouillon de facture est retiré (il n’avait pas de numéro).'];
    return [`${a.cible} est retiré du CRM.`];
  }
  return a.changements.map((c) => `${c.champ} : ${c.avant ?? (c.champ === 'Historique' ? 'ligne retirée' : 'vide')}`);
}

export default function ActionsIA() {
  const d = useErp();
  const [source, setSource] = useState<Source>('tout');
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [aAnnuler, setAAnnuler] = useState<ActionAgent | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [retour, setRetour] = useState<{ ton: 'succes' | 'danger'; texte: string } | null>(null);

  const nom = useMemo(() => {
    const parEmail = new Map(d.utilisateurs.map((u) => [u.email.toLowerCase(), u.nom]));
    return (email: string) => parEmail.get(email.toLowerCase()) ?? email.split('@')[0];
  }, [d.utilisateurs]);
  const toutes = useMemo(() => actionsVisibles(d.actionsAgent, AUJOURDHUI), [d.actionsAgent]);
  const etats = useMemo(() => new Map<string, EtatAffiche>(toutes.map((a) => [a.id, etatAffiche(a, d.filsMessages, nom)])), [toutes, d.filsMessages, nom]);
  const aEnvoyer = toutes.filter((a) => etats.get(a.id)?.aEnvoyer);
  const liste = toutes.filter((a) => source === 'tout' || a.source === source);
  const jours = useMemo(() => {
    const m = new Map<string, ActionAgent[]>();
    for (const a of liste) m.set(a.le.slice(0, 10), [...(m.get(a.le.slice(0, 10)) ?? []), a]);
    return [...m.entries()];
  }, [liste]);

  const qui = (a: ActionAgent) =>
    a.client?.genre === 'cle'
      ? 'Fait par Claude, avec la clé du connecteur'
      : a.client?.genre === 'oauth'
        ? `Fait par Claude${a.client.autorisePar ? `, connecté par ${nom(a.client.autorisePar)}` : ''}`
        : 'Fait par votre agent de messagerie';

  /** Relit la cible dans la base, puis annule si elle n'a pas changé depuis l'action. */
  const annuler = async () => {
    const a = aAnnuler;
    if (!a || enCours) return;
    setEnCours(true);
    setRetour(null);
    const enStore = (d.donnees[a.collection] as { id: string }[]).find((x) => x.id === a.cibleId);
    const lu = d.demo ? enStore : await d.relire(a.collection, a.cibleId);
    if (!lu && enStore && !d.demo) {
      // Une modification en attente d'enregistrement, ou la base injoignable : on ne décide pas à l'aveugle.
      setRetour({ ton: 'danger', texte: 'Impossible de relire cet élément pour l’instant : réessayez dans un instant. Rien n’a été annulé.' });
    } else {
      const r = annulerAction(a, lu ?? undefined, { espace: espaceOuvert().id, le: horodatageMaintenant(), par: d.utilisateur.nom });
      if (r.ok) {
        if (r.ecriture.genre === 'supprimer') d.remove(r.ecriture.collection, r.ecriture.id);
        else d.upsert(r.ecriture.collection, r.ecriture.element as never);
        d.upsert('actionsAgent', r.action);
        setRetour({ ton: 'succes', texte: r.message });
      } else setRetour({ ton: 'danger', texte: r.raison });
    }
    setAAnnuler(null);
    setEnCours(false);
  };

  const boutonAnnuler = (a: ActionAgent) => (
    <Button size="sm" variant="ghost" onClick={() => setAAnnuler(a)} aria-label={`${a.retour?.genre === 'proposition' ? 'Retirer' : 'Annuler'} : ${a.resume}`}>
      {a.retour?.genre === 'proposition' ? 'Retirer' : 'Annuler'}
    </Button>
  );

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="min-w-0 flex-1 text-[14px] text-(--lm-encre-2)">
          Ce que Claude et votre agent ont fait dans l’ERP. Aucun prix n’est changé, aucun paiement n’est fait.
        </p>
        <Segmente
          label="Qui"
          valeur={source}
          onChange={setSource}
          options={[
            { valeur: 'tout', libelle: 'Tout' },
            { valeur: 'claude', libelle: 'Claude' },
            { valeur: 'agent', libelle: 'Votre agent' },
          ]}
        />
      </div>

      {retour && (
        <Alert tone={retour.ton} actionsDessous actions={<Button size="sm" variant="secondary" onClick={() => setRetour(null)}>OK</Button>}>
          {retour.texte}
        </Alert>
      )}

      {aEnvoyer.length > 0 && (
        <Card>
          <CardHeader
            titre={pluriel(aEnvoyer.length, 'réponse à envoyer', 'réponses à envoyer')}
            description="Préparées par l’IA, rien n’est parti. Relisez-les et envoyez-les depuis la Messagerie."
          />
          <ul className="-mb-2 divide-y divide-(--lm-bord) border-t border-(--lm-bord)">
            {aEnvoyer.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium text-(--lm-encre)">{a.cible}</p>
                  <p className="line-clamp-2 text-[12.5px] text-(--lm-encre-2)">
                    {LIBELLE_SOURCE[a.source]} · {a.changements.find((c) => c.champ === 'Réponse proposée')?.apres ?? a.resume}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {!d.lectureSeule && boutonAnnuler(a)}
                  {lienSur(a.lien) && (
                    <ButtonLink to={lienSur(a.lien)!} size="sm" variant="primary" icone={<MessageSquareText />}>
                      Ouvrir
                    </ButtonLink>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {jours.length === 0 ? (
        <EmptyState
          icone={<Sparkles />}
          titre={source === 'tout' ? 'Rien pour l’instant' : `Rien de ${source === 'claude' ? 'Claude' : 'votre agent'} pour l’instant`}
          description="Quand Claude ou votre agent font quelque chose dans l’ERP, c’est noté ici."
        />
      ) : (
        jours.map(([jour, actions]) => (
          <section key={jour} aria-label={titreJour(jour)}>
            <h3 className="mb-2 text-[12px] font-semibold tracking-wide text-(--lm-encre-3) uppercase">{titreJour(jour)}</h3>
            <Card flush>
              <ol className="divide-y divide-(--lm-bord)">
                {actions.map((a) => {
                  const etat = etats.get(a.id) ?? { libelle: '', ton: 'neutre' as const, annulable: false };
                  const deplie = ouverte === a.id;
                  return (
                    <li key={a.id} className="flex items-start gap-3 px-4 py-3">
                      <span
                        aria-hidden
                        className={cn(
                          'mt-0.5 grid size-9 shrink-0 place-items-center rounded-full [&_svg]:size-4',
                          a.source === 'claude' ? 'bg-(--lm-or-lavis) text-(--lm-or-texte)' : 'bg-(--lm-neutre-lavis) text-(--lm-encre-2)',
                        )}
                      >
                        {a.source === 'claude' ? <Sparkles /> : <Bot />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <button type="button" onClick={() => setOuverte(deplie ? null : a.id)} aria-expanded={deplie} className="block w-full rounded-md text-left focus-visible:ring-2 focus-visible:ring-(--lm-or-anneau) focus:outline-none">
                          <span className="flex items-baseline gap-2">
                            <span className={cn('min-w-0 flex-1 text-[13.5px] text-(--lm-encre)', a.etat === 'annulee' && 'text-(--lm-encre-3) line-through decoration-(--lm-bord-fort)')}>{a.resume}</span>
                            <time dateTime={a.le} className="lm-chiffres shrink-0 text-[12px] text-(--lm-encre-3)">
                              {heure(a.le)}
                            </time>
                          </span>
                          <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-(--lm-encre-3)">
                            <span>{LIBELLE_SOURCE[a.source]}</span>
                            {/* La phrase dit déjà ce qui est fait : un badge seulement pour ce qui reste à faire ou a changé depuis. */}
                            {a.etat !== 'faite' && etat.libelle && <Badge tone={etat.ton}>{etat.libelle}</Badge>}
                          </span>
                        </button>
                        {deplie && (
                          <div className="mt-2 space-y-2 rounded-lg bg-(--lm-surface-2) px-3 py-2 text-[12.5px]">
                            {a.changements.length > 0 && (
                              <dl className="space-y-1">
                                {a.changements.map((c, i) => (
                                  <div key={i} className="flex flex-wrap gap-x-2">
                                    <dt className="text-(--lm-encre-3)">{c.champ}</dt>
                                    <dd className="min-w-0 text-(--lm-encre)">
                                      {c.avant !== undefined && <span className="text-(--lm-encre-2)">{c.avant} → </span>}
                                      {c.apres}
                                    </dd>
                                  </div>
                                ))}
                              </dl>
                            )}
                            <p className="text-(--lm-encre-2)">{qui(a)}.</p>
                            {!etat.annulable && a.etat !== 'annulee' && a.pasAnnulable && <p className="text-(--lm-encre-2)">{a.pasAnnulable}</p>}
                            {lienSur(a.lien) && (
                              <Link to={lienSur(a.lien)!} className="inline-flex min-h-8 items-center font-medium text-(--lm-or-texte) hover:underline">
                                Voir dans l’ERP
                              </Link>
                            )}
                          </div>
                        )}
                      </div>
                      {/* Une réponse à envoyer se retire depuis la carte du haut. */}
                      {etat.annulable && !etat.aEnvoyer && !d.lectureSeule && <div className="shrink-0">{boutonAnnuler(a)}</div>}
                    </li>
                  );
                })}
              </ol>
            </Card>
          </section>
        ))
      )}

      <Aide titre="Ce que l’IA peut faire" className="mb-0">
        <ul className="mt-2 space-y-1.5 text-[13px] text-(--lm-encre-2)">
          {ACTIONS_POSSIBLES.map((x) => (
            <li key={x.cle}>
              <span className="font-medium text-(--lm-encre)">{x.libelle}</span> : {x.regle}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[13px] text-(--lm-encre-2)">
          « Annuler » remet la fiche comme avant, tant que personne ne l’a changée depuis. Les actions sont gardées 90 jours, sans code d’accès ni coordonnées de voyageur.
        </p>
      </Aide>

      <Modal
        ouvert={!!aAnnuler}
        onFermer={() => setAAnnuler(null)}
        taille="sm"
        titre={aAnnuler?.retour?.genre === 'proposition' ? 'Retirer la réponse proposée ?' : 'Annuler cette action ?'}
        description={aAnnuler?.resume}
        pied={
          <>
            <Button variant="secondary" onClick={() => setAAnnuler(null)}>
              Garder
            </Button>
            <Button variant="danger" chargement={enCours} onClick={() => void annuler()}>
              {aAnnuler?.retour?.genre === 'proposition' ? 'Retirer' : 'Annuler l’action'}
            </Button>
          </>
        }
      >
        {aAnnuler && ceQuiRevient(aAnnuler).length > 0 && (
          <div className="text-[13px] text-(--lm-encre-2)">
            {aAnnuler.retour?.genre === 'champs' && <p className="mb-1 font-medium text-(--lm-encre)">Revient comme avant :</p>}
            <ul className="space-y-1">
              {ceQuiRevient(aAnnuler).map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </div>
        )}
      </Modal>
    </div>
  );
}
