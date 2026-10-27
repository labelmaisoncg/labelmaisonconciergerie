/**
 * Paramètres → Espaces (gérants de Label Maison seulement) : Label Maison est
 * la plateforme. On y invite une conciergerie (son nom, l'adresse de la
 * personne qui ouvrira son espace), on voit les espaces et les invitations en
 * attente, on suspend ou rouvre un espace.
 *
 * Tout passe par api/erp-espaces.ts avec la session du gérant ; la base
 * revérifie ses droits (supabase/erp-espaces.sql : erp.inviter_espace…).
 * L'invitation est liée à l'adresse et à un code à usage unique (dans le
 * lien), valable 14 jours ; la conciergerie crée ensuite son espace elle-même
 * (layout/CreerEspace.tsx), au nom donné ici. Les gestes qui coupent l'accès
 * (suspendre, annuler) demandent une confirmation.
 */
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Ban, Building2, Copy, Send } from 'lucide-react';
import { useErp } from '../../data/store';
import { ID_LABEL_MAISON } from '../../data/espaces';
import { dateCourte } from '../../data/format';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Field, Input, Modal } from '../../ui';
import { appelerRouteGerant } from '../crm/_composants/api-connecteur';

const API = '/api/erp-espaces';
const INDISPONIBLE = 'Espaces indisponibles pour le moment. Réessayez dans un instant.';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

interface EspacePlateforme {
  id: string;
  code: string;
  nom: string;
  actif: boolean;
  cree_le: string;
  contact: string | null;
  membres: number;
}

interface InvitationPlateforme {
  id: string;
  email: string;
  nom: string;
  expire_le: string;
  expiree: boolean;
}

interface Liste {
  ok?: boolean;
  erreur?: string;
  espaces: EspacePlateforme[];
  invitations: InvitationPlateforme[];
  email: boolean;
}

interface Retour {
  ok?: boolean;
  erreur?: string;
  lien?: string;
  envoye?: boolean;
}

/** Résultat d'une invitation, montré là où on l'a envoyée (formulaire, ou ligne de l'invitation). */
interface Resultat {
  ou: string;
  ton: 'succes' | 'info' | 'danger';
  texte: string;
  lien?: string;
}

/** Geste qui coupe un accès : confirmé dans une fenêtre, une seule action rouge. */
interface AConfirmer {
  titre: string;
  description: string;
  action: string;
  corps: Record<string, unknown>;
  cle: string;
}

const jour = (iso: string) => (iso ? dateCourte(iso.slice(0, 10)) : '');

function LienACopier({ lien }: { lien: string }) {
  const [copie, setCopie] = useState(false);
  return (
    <span className="mt-2 flex flex-wrap items-center gap-2">
      <code className="text-[12.5px] text-(--lm-encre) [overflow-wrap:anywhere]">{lien}</code>
      <Button
        size="sm"
        variant="secondary"
        icone={<Copy />}
        onClick={() =>
          void navigator.clipboard
            ?.writeText(lien)
            .then(() => setCopie(true))
            .catch(() => undefined)
        }
      >
        {copie ? 'Lien copié' : 'Copier le lien'}
      </Button>
    </span>
  );
}

function MessageResultat({ r, className }: { r: Resultat; className?: string }): ReactNode {
  return (
    <Alert tone={r.ton} className={className}>
      {r.texte}
      {r.lien && <LienACopier lien={r.lien} />}
    </Alert>
  );
}

export default function Espaces() {
  const d = useErp();
  const [liste, setListe] = useState<Liste | null>(null);
  const [erreur, setErreur] = useState<string>();
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [enCours, setEnCours] = useState<string | null>(null);
  const [resultat, setResultat] = useState<Resultat | null>(null);
  const [aConfirmer, setAConfirmer] = useState<AConfirmer | null>(null);

  const relire = useCallback(async () => {
    if (d.mode !== 'reel') return;
    try {
      setListe(await appelerRouteGerant<Liste>(`${API}?action=plateforme`, undefined, INDISPONIBLE));
      setErreur(undefined);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : INDISPONIBLE);
    }
  }, [d.mode]);

  useEffect(() => {
    void relire();
  }, [relire]);

  const inviter = async (cible: { nom: string; email: string }, cle: string) => {
    setEnCours(cle);
    setResultat(null);
    const adresse = cible.email.trim();
    // Renvoi : le nouveau lien remplace l'ancien (erp.inviter_espace change le code).
    const remplace = cle.startsWith('renvoyer-') ? ' L’ancien lien ne marche plus.' : '';
    try {
      const r = await appelerRouteGerant<Retour>(API, { action: 'inviter', nom: cible.nom.trim(), email: adresse }, INDISPONIBLE);
      setResultat(
        r.envoye
          ? { ou: cle, ton: 'succes', texte: `Invitation envoyée à ${adresse}. Elle est valable 14 jours.${remplace}` }
          : {
              ou: cle,
              ton: 'info',
              texte: `Aucun e-mail n’est parti. Envoyez ce lien à ${adresse} : il sert une seule fois, pendant 14 jours, pour créer son compte puis l’espace de sa conciergerie.${remplace}`,
              lien: r.lien,
            },
      );
      if (cle === 'nouvelle') {
        setNom('');
        setEmail('');
      }
      await relire();
    } catch (e) {
      setResultat({ ou: cle, ton: 'danger', texte: e instanceof Error ? e.message : INDISPONIBLE });
    } finally {
      setEnCours(null);
    }
  };

  const envoyer = (e: FormEvent) => {
    e.preventDefault();
    if (!nom.trim()) return setResultat({ ou: 'nouvelle', ton: 'danger', texte: 'Donnez le nom de la conciergerie.' });
    if (!EMAIL.test(email.trim())) return setResultat({ ou: 'nouvelle', ton: 'danger', texte: 'Adresse e-mail invalide.' });
    void inviter({ nom, email }, 'nouvelle');
  };

  const agir = async (corps: Record<string, unknown>, cle: string) => {
    setAConfirmer(null);
    setEnCours(cle);
    setResultat(null);
    try {
      await appelerRouteGerant<{ ok?: boolean; erreur?: string }>(API, corps, INDISPONIBLE);
      await relire();
    } catch (e) {
      setResultat({ ou: cle, ton: 'danger', texte: e instanceof Error ? e.message : INDISPONIBLE });
    } finally {
      setEnCours(null);
    }
  };

  if (d.mode !== 'reel') {
    return (
      <div className="max-w-3xl">
        <Alert tone="neutre">Indisponible en démonstration.</Alert>
      </div>
    );
  }

  const autres = (liste?.espaces ?? []).filter((e) => e.id !== ID_LABEL_MAISON);
  const resultatDe = (cle: string, className = 'mt-3') => (resultat?.ou === cle ? <MessageResultat r={resultat} className={className} /> : null);

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <Card>
        <CardHeader
          titre="Inviter une conciergerie"
          description="La personne crée son compte avec cette adresse, puis l’espace de sa conciergerie, à ce nom, qu’elle gère seule. Invitation valable 14 jours, une seule fois."
        />
        <form onSubmit={envoyer} noValidate className="grid gap-3 sm:grid-cols-2">
          <Field label="Nom de la conciergerie" aide="Il ne se change plus ensuite.">
            <Input value={nom} maxLength={80} onChange={(e) => setNom(e.target.value)} autoComplete="organization" />
          </Field>
          <Field label="E-mail de la personne qui ouvrira l’espace">
            <Input type="email" inputMode="email" autoCapitalize="off" spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit" variant="primary" icone={<Send />} chargement={enCours === 'nouvelle'} disabled={!!enCours}>
              Inviter
            </Button>
          </div>
        </form>
        {resultatDe('nouvelle')}
      </Card>

      {erreur && <Alert tone="danger">{erreur}</Alert>}

      {liste && liste.invitations.length > 0 && (
        <Card>
          <CardHeader titre="Invitations en attente" description="La conciergerie n’a pas encore créé son espace." />
          <ul className="divide-y divide-(--lm-bord)">
            {liste.invitations.map((i) => (
              <li key={i.id} className="py-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-medium text-(--lm-encre)">{i.nom}</p>
                    <p className="flex flex-wrap items-center gap-x-1.5 text-[12.5px] text-(--lm-encre-2)">
                      <span className="[overflow-wrap:anywhere]">{i.email}</span>
                      <span aria-hidden>·</span>
                      {i.expiree ? <Badge tone="alerte">Expirée</Badge> : <span>valable jusqu’au {jour(i.expire_le)}</span>}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" variant="secondary" chargement={enCours === `renvoyer-${i.id}`} disabled={!!enCours} onClick={() => void inviter(i, `renvoyer-${i.id}`)}>
                      Renvoyer
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      chargement={enCours === `annuler-${i.id}`}
                      disabled={!!enCours}
                      onClick={() =>
                        setAConfirmer({
                          titre: `Annuler l’invitation de ${i.nom} ?`,
                          description: `Le lien envoyé à ${i.email} ne servira plus. Vous pourrez inviter de nouveau.`,
                          action: 'Annuler l’invitation',
                          corps: { action: 'annuler', id: i.id },
                          cle: `annuler-${i.id}`,
                        })
                      }
                    >
                      Annuler
                    </Button>
                  </div>
                </div>
                {resultatDe(`renvoyer-${i.id}`)}
                {resultatDe(`annuler-${i.id}`)}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <CardHeader titre="Espaces" description="Chaque conciergerie a ses logements, son équipe et ses propriétaires ; rien ne passe d’un espace à l’autre." />
        {!liste && !erreur && <p className="text-[13.5px] text-(--lm-encre-2)">Chargement…</p>}
        {liste && autres.length === 0 && (
          <EmptyState icone={<Building2 />} titre="Aucune autre conciergerie pour l’instant" description="Invitez-en une ci-dessus : son espace apparaîtra ici dès qu’elle l’aura créé." />
        )}
        {autres.length > 0 && (
          <ul className="divide-y divide-(--lm-bord)">
            {autres.map((e) => (
              <li key={e.id} className="py-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                  <div className="min-w-0 flex-1">
                    {/* Le code technique (adresse du webhook) reste au survol, hors de la lecture. */}
                    <p className="flex flex-wrap items-center gap-2 text-[14px] font-medium text-(--lm-encre)" title={`Code : ${e.code}`}>
                      {e.nom}
                      {!e.actif && <Badge tone="alerte">Suspendu</Badge>}
                    </p>
                    <p className="flex flex-wrap items-center gap-x-1.5 text-[12.5px] text-(--lm-encre-2)">
                      <span>Créé le {jour(e.cree_le)}</span>
                      <span aria-hidden>·</span>
                      <span>
                        {e.membres} membre{e.membres > 1 ? 's' : ''}
                      </span>
                      {e.contact && (
                        <>
                          <span aria-hidden>·</span>
                          <span className="[overflow-wrap:anywhere]">{e.contact}</span>
                        </>
                      )}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="self-start sm:self-center"
                    chargement={enCours === `suspendre-${e.id}`}
                    disabled={!!enCours}
                    onClick={() =>
                      e.actif
                        ? setAConfirmer({
                            titre: `Suspendre l’espace de ${e.nom} ?`,
                            description: 'Son équipe, ses propriétaires et ses responsables n’y entrent plus ; l’agent et les mises à jour s’arrêtent. Rien n’est effacé : vous pourrez le rouvrir.',
                            action: 'Suspendre l’espace',
                            corps: { action: 'suspendre', espace: e.id, actif: false },
                            cle: `suspendre-${e.id}`,
                          })
                        : void agir({ action: 'suspendre', espace: e.id, actif: true }, `suspendre-${e.id}`)
                    }
                  >
                    {e.actif ? 'Suspendre' : 'Rouvrir'}
                  </Button>
                </div>
                {resultatDe(`suspendre-${e.id}`)}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal
        ouvert={!!aConfirmer}
        onFermer={() => setAConfirmer(null)}
        titre={aConfirmer?.titre ?? ''}
        description={aConfirmer?.description}
        taille="sm"
        pied={
          <>
            <Button variant="ghost" onClick={() => setAConfirmer(null)}>
              Garder
            </Button>
            <Button variant="danger" icone={<Ban />} onClick={() => aConfirmer && void agir(aConfirmer.corps, aConfirmer.cle)}>
              {aConfirmer?.action}
            </Button>
          </>
        }
      />
    </div>
  );
}
