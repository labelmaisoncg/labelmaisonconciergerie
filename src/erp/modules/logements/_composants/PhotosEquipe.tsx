import { useState, type FormEvent } from 'react';
import { ImagePlus, Link2, Star, Trash2 } from 'lucide-react';
import { MODE_DEMO } from '../../../data/config';
import { extraireIdAirbnb, idAirbnbDuLogement, lienAnnonceAirbnb } from '../../../data/page-airbnb';
import { useErp } from '../../../data/store';
import type { Annonce, Logement } from '../../../data/types';
import { Button, EnvoiFichier, Field, IconButton, Input, Modal, useLienFichier } from '../../../ui';

/**
 * « Ajouter des photos » : plusieurs photos du téléphone ou de l'ordinateur,
 * rangées dans l'espace privé de l'ERP. Elles passent avant celles des
 * plateformes et aucune synchronisation ne les touche.
 */
export function AjouterPhotos({ logement: l }: { logement: Logement }) {
  const d = useErp();
  if (d.lectureSeule) return null;
  return (
    <EnvoiFichier
      dossier={`logements/${l.id}/photos`}
      accept="image/*"
      multiple
      libelle="Ajouter des photos"
      icone={<ImagePlus />}
      tailleMaxMo={15}
      onEnvoye={(urls, fichiers) => {
        // Démo : rien n'est envoyé ; un lien local montre les photos le temps de la visite.
        const adresses = MODE_DEMO ? fichiers.map((f) => URL.createObjectURL(f)) : urls;
        d.upsert('logements', { ...l, photosEquipe: [...(l.photosEquipe ?? []), ...adresses] });
      }}
    />
  );
}

function Miniature({ url }: { url: string }) {
  const lien = useLienFichier(url);
  return lien ? (
    <img src={lien} alt="" loading="lazy" className="aspect-[4/3] w-full bg-(--lm-surface-2) object-cover" />
  ) : (
    <span aria-hidden className="block aspect-[4/3] w-full bg-(--lm-surface-2)" />
  );
}

/** « Vos photos » : les photos déposées par l'équipe, à mettre en couverture ou à retirer. */
export function OrganiserPhotos({ logement: l }: { logement: Logement }) {
  const d = useErp();
  const [ouvert, setOuvert] = useState(false);
  const equipe = l.photosEquipe ?? [];
  if (d.lectureSeule || !equipe.length) return null;
  const enregistrer = (photosEquipe: string[]) => d.upsert('logements', { ...l, photosEquipe });
  return (
    <>
      <Button size="sm" onClick={() => setOuvert(true)}>
        Vos photos ({equipe.length})
      </Button>
      <Modal ouvert={ouvert} onFermer={() => setOuvert(false)} titre="Vos photos" description="Elles passent avant celles des plateformes. La première sert de couverture." taille="lg">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {equipe.map((u, i) => (
            <li key={u} className="overflow-hidden rounded-lg border border-(--lm-bord)">
              <Miniature url={u} />
              <div className="flex items-center justify-between gap-1 px-1.5 py-1">
                {i === 0 ? (
                  <span className="px-1.5 text-[12.5px] font-medium text-(--lm-or-texte)">Couverture</span>
                ) : (
                  <IconButton label={`Mettre la photo ${i + 1} en couverture`} size="sm" onClick={() => enregistrer([u, ...equipe.filter((x) => x !== u)])}>
                    <Star />
                  </IconButton>
                )}
                <IconButton
                  label={`Retirer la photo ${i + 1}`}
                  size="sm"
                  onClick={() => {
                    if (window.confirm('Retirer cette photo du logement ?')) enregistrer(equipe.filter((x) => x !== u));
                  }}
                >
                  <Trash2 />
                </IconButton>
              </div>
            </li>
          ))}
        </ul>
      </Modal>
    </>
  );
}

/**
 * « Ajouter le lien Airbnb » : pour un logement qui n'a pas d'annonce Airbnb
 * reliée mais qui y est aussi publié. Le lien sert à lire les photos de la
 * page publique de l'annonce au prochain relevé (rien n'est envoyé à Airbnb).
 */
export function LienAirbnb({ logement: l }: { logement: Logement }) {
  const d = useErp();
  const [ouvert, setOuvert] = useState(false);
  const [valeur, setValeur] = useState('');
  const [erreur, setErreur] = useState('');
  if (d.lectureSeule || idAirbnbDuLogement(l)) return null;
  if (!ouvert) {
    return (
      <Button size="sm" icone={<Link2 />} onClick={() => setOuvert(true)}>
        Ajouter le lien Airbnb
      </Button>
    );
  }
  const enregistrer = (e: FormEvent) => {
    e.preventDefault();
    const id = extraireIdAirbnb(valeur);
    if (!id) {
      setErreur('Collez le lien d’une annonce Airbnb, par exemple https://www.airbnb.fr/rooms/123456.');
      return;
    }
    const airbnb: Annonce = { canal: 'airbnb', url: lienAnnonceAirbnb(id), connecte: false };
    d.upsert('logements', {
      ...l,
      annonces: [...l.annonces.filter((a) => a.canal !== 'airbnb'), airbnb],
      // Photos relues au prochain relevé, sans attendre le lendemain.
      ...(l.repull ? { repull: { ...l.repull, photosLuesLe: undefined } } : {}),
    });
    setOuvert(false);
  };
  return (
    <form onSubmit={enregistrer} className="flex w-full flex-col gap-2 sm:flex-row sm:items-end">
      <Field label="Lien de l’annonce Airbnb (si ce logement y est aussi)" erreur={erreur || undefined} className="min-w-0 flex-1">
        <Input
          value={valeur}
          onChange={(e) => {
            setValeur(e.target.value);
            setErreur('');
          }}
          placeholder="https://www.airbnb.fr/rooms/…"
          inputMode="url"
          autoFocus
        />
      </Field>
      <div className="flex gap-2">
        <Button type="submit">Enregistrer</Button>
        <Button variant="ghost" onClick={() => setOuvert(false)}>
          Annuler
        </Button>
      </div>
    </form>
  );
}
