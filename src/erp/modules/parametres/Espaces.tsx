/**
 * Paramètres → Espaces (gérants de Label Maison seulement) : Label Maison est
 * la plateforme. On y invite une conciergerie (son nom, l'adresse de la
 * personne qui ouvrira son espace), on voit les espaces et les invitations en
 * attente, on suspend ou rouvre un espace.
 *
 * Tout passe par api/erp-espaces.ts avec la session du gérant ; la base
 * revérifie ses droits (supabase/erp-espaces.sql : erp.inviter_espace…).
 * L'invitation est liée à l'adresse, valable 14 jours, à usage unique ; la
 * conciergerie crée ensuite son espace elle-même (layout/CreerEspace.tsx).
 */
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Building2, Copy, Send } from 'lucide-react';
import { useErp } from '../../data/store';
import { ID_LABEL_MAISON } from '../../data/espaces';
import { dateCourte } from '../../data/format';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Field, Input } from '../../ui';
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

const jour = (iso: string) => (iso ? dateCourte(iso.slice(0, 10)) : '');

export default function Espaces() {
  const d = useErp();
  const [liste, setListe] = useState<Liste | null>(null);
  const [erreur, setErreur] = useState<string>();
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [enCours, setEnCours] = useState<string | null>(null);
  const [retour, setRetour] = useState<{ ton: 'succes' | 'info' | 'danger'; texte: string; lien?: string } | null>(null);

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
    setRetour(null);
    try {
      const r = await appelerRouteGerant<Retour>(API, { action: 'inviter', nom: cible.nom.trim(), email: cible.email.trim() }, INDISPONIBLE);
      setRetour(
        r.envoye
          ? { ton: 'succes', texte: `Invitation envoyée à ${cible.email.trim()}. Elle est valable 14 jours.` }
          : {
              ton: 'info',
              texte: `Aucun e-mail n’est parti. Envoyez ce lien à ${cible.email.trim()} : la personne crée son compte avec cette adresse, puis l’espace de sa conciergerie. Valable 14 jours.`,
              lien: r.lien,
            },
      );
      if (cle === 'nouvelle') {
        setNom('');
        setEmail('');
      }
      await relire();
    } catch (e) {
      setRetour({ ton: 'danger', texte: e instanceof Error ? e.message : INDISPONIBLE });
    } finally {
      setEnCours(null);
    }
  };

  const envoyer = (e: FormEvent) => {
    e.preventDefault();
    if (!nom.trim()) return setRetour({ ton: 'danger', texte: 'Donnez le nom de la conciergerie.' });
    if (!EMAIL.test(email.trim())) return setRetour({ ton: 'danger', texte: 'Adresse e-mail invalide.' });
    void inviter({ nom, email }, 'nouvelle');
  };

  const agir = async (corps: Record<string, unknown>, cle: string, confirmation?: string) => {
    if (confirmation && !window.confirm(confirmation)) return;
    setEnCours(cle);
    setRetour(null);
    try {
      await appelerRouteGerant<{ ok?: boolean; erreur?: string }>(API, corps, INDISPONIBLE);
      await relire();
    } catch (e) {
      setRetour({ ton: 'danger', texte: e instanceof Error ? e.message : INDISPONIBLE });
    } finally {
      setEnCours(null);
    }
  };

  const copier = (lien: string) => {
    void navigator.clipboard?.writeText(lien).catch(() => undefined);
  };

  if (d.mode !== 'reel') {
    return (
      <div className="max-w-3xl">
        <Alert tone="neutre">Indisponible en démonstration.</Alert>
      </div>
    );
  }

  const autres = (liste?.espaces ?? []).filter((e) => e.id !== ID_LABEL_MAISON);

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <Card>
        <CardHeader
          titre="Inviter une conciergerie"
          description="La personne crée son compte avec cette adresse, puis l’espace de sa conciergerie, qu’elle gère seule. Invitation valable 14 jours, une seule fois."
        />
        <form onSubmit={envoyer} noValidate className="grid gap-3 sm:grid-cols-2">
          <Field label="Nom de la conciergerie">
            <Input value={nom} maxLength={80} onChange={(e) => setNom(e.target.value)} autoComplete="organization" />
          </Field>
          <Field label="E-mail de la personne qui ouvrira l’espace">
            <Input type="email" inputMode="email" autoCapitalize="off" spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit" variant="primary" icone={<Send />} chargement={enCours === 'nouvelle'} disabled={!!enCours}>
              Inviter
            </Button>
            {liste && !liste.email && (
              <p className="mt-2 text-[12.5px] text-(--lm-encre-2)">Sans envoi d’e-mail configuré, le lien s’affiche ici pour que vous le transmettiez.</p>
            )}
          </div>
        </form>
        {retour && (
          <Alert tone={retour.ton} className="mt-3">
            {retour.texte}
            {retour.lien && (
              <span className="mt-2 flex flex-wrap items-center gap-2">
                <code className="break-all text-[12.5px] text-(--lm-encre)">{retour.lien}</code>
                <Button size="sm" variant="secondary" icone={<Copy />} onClick={() => copier(retour.lien!)}>
                  Copier le lien
                </Button>
              </span>
            )}
          </Alert>
        )}
      </Card>

      {erreur && <Alert tone="danger">{erreur}</Alert>}

      {liste && liste.invitations.length > 0 && (
        <Card>
          <CardHeader titre="Invitations en attente" description="La conciergerie n’a pas encore créé son espace." />
          <ul className="divide-y divide-(--lm-bord)">
            {liste.invitations.map((i) => (
              <li key={i.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium text-(--lm-encre)">{i.nom}</p>
                  <p className="text-[12.5px] break-all text-(--lm-encre-2)">
                    {i.email} · {i.expiree ? <Badge tone="alerte">Expirée</Badge> : `valable jusqu’au ${jour(i.expire_le)}`}
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
                    onClick={() => void agir({ action: 'annuler', id: i.id }, `annuler-${i.id}`, `Annuler l’invitation de ${i.nom} (${i.email}) ?`)}
                  >
                    Annuler
                  </Button>
                </div>
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
              <li key={e.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-[14px] font-medium text-(--lm-encre)">
                    {e.nom}
                    {e.actif ? <Badge tone="succes">Actif</Badge> : <Badge tone="alerte">Suspendu</Badge>}
                  </p>
                  <p className="text-[12.5px] break-all text-(--lm-encre-2)">
                    Créé le {jour(e.cree_le)} · {e.membres} membre{e.membres > 1 ? 's' : ''}
                    {e.contact ? ` · ${e.contact}` : ''} · code {e.code}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  className="self-start sm:self-center"
                  chargement={enCours === `suspendre-${e.id}`}
                  disabled={!!enCours}
                  onClick={() =>
                    void agir(
                      { action: 'suspendre', espace: e.id, actif: !e.actif },
                      `suspendre-${e.id}`,
                      e.actif
                        ? `Suspendre l’espace de ${e.nom} ? Son équipe, ses propriétaires et ses responsables n’y entrent plus, l’agent et les mises à jour s’arrêtent. Rien n’est effacé.`
                        : undefined,
                    )
                  }
                >
                  {e.actif ? 'Suspendre' : 'Rouvrir'}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
