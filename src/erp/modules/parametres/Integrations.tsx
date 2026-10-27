import { useState } from 'react';
import { espaceOuvert, estLabelMaison } from '../../data/espaces';
import { CarteRepullEspace } from './RepullEspace';
import { CarteSynchroRepull } from './SynchroRepull';

/**
 * Plateformes : la mise à jour depuis Airbnb et Booking.com (état réel, bouton
 * « Synchroniser maintenant », lien vers les connexions). Les détails
 * techniques restent repliés dans « Avancé ». L'espace d'une conciergerie
 * invitée relie d'abord son propre compte Repull (Label Maison garde ses
 * clés dans Vercel) ; la synchronisation n'apparaît qu'une fois la clé
 * enregistrée (un seul bouton principal à la fois).
 */
export default function Integrations() {
  const labelMaison = estLabelMaison(espaceOuvert());
  const [cle, setCle] = useState(false);
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      {!labelMaison && <CarteRepullEspace surCle={setCle} />}
      {(labelMaison || cle) && <CarteSynchroRepull />}
    </div>
  );
}
