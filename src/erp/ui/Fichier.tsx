/**
 * Fichiers de l'ERP (photos de ménage, preuves d'incident, documents
 * prestataires) : envoi dans l'espace privé Supabase, liens signés à
 * l'affichage. En démo locale, rien n'est envoyé (adresses « demo:// »).
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Paperclip } from 'lucide-react';
import { MODE_DEMO } from '../data/config';
import { estFichierStocke, lienFichier, televerser } from '../data/supabase';
import { Button, type TailleBouton, type VarianteBouton } from './Button';
import { cn } from './cn';

/** Adresse affichable d'un fichier : lien signé (stockage), adresse web telle quelle, rien pour la démo. */
export function useLienFichier(url?: string): string | undefined {
  const [lien, setLien] = useState<string | undefined>(() => (url && !url.startsWith('demo://') && !estFichierStocke(url) ? url : undefined));
  useEffect(() => {
    let actif = true;
    if (!url || url.startsWith('demo://')) setLien(undefined);
    else if (!estFichierStocke(url)) setLien(url);
    else {
      setLien(undefined);
      void lienFichier(url).then((l) => actif && setLien(l ?? undefined));
    }
    return () => {
      actif = false;
    };
  }, [url]);
  return lien;
}

/** Lien « Ouvrir » vers un fichier (résolu à la demande pour un fichier stocké). */
export function LienFichier({ url, children, className }: { url: string; children: ReactNode; className?: string }) {
  const lien = useLienFichier(url);
  if (!lien) return <span className={className}>{children}</span>;
  return (
    <a href={lien} target="_blank" rel="noreferrer" className={className}>
      {children}
    </a>
  );
}

export interface EnvoiFichierProps {
  /** Dossier de rangement dans l'espace privé, ex. « missions/mis-12/avant ». */
  dossier: string;
  accept?: string;
  multiple?: boolean;
  libelle?: string;
  variant?: VarianteBouton;
  size?: TailleBouton;
  icone?: ReactNode;
  className?: string;
  disabled?: boolean;
  /** Adresses à enregistrer (« stockage://... »), dans l'ordre des fichiers choisis. */
  onEnvoye: (urls: string[]) => void;
}

/** Bouton « joindre un fichier » : choix, envoi, erreurs affichées sous le bouton. */
export function EnvoiFichier({
  dossier,
  accept,
  multiple,
  libelle = 'Joindre un fichier',
  variant = 'secondary',
  size = 'sm',
  icone,
  className,
  disabled,
  onEnvoye,
}: EnvoiFichierProps) {
  const champ = useRef<HTMLInputElement>(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string>();

  const choisis = async (fichiers: FileList | null) => {
    const liste = fichiers ? Array.from(fichiers) : [];
    if (champ.current) champ.current.value = '';
    if (!liste.length) return;
    setErreur(undefined);
    if (MODE_DEMO) {
      onEnvoye(liste.map((f) => `demo://${dossier}/${f.name}`));
      return;
    }
    setEnCours(true);
    const urls: string[] = [];
    const erreurs: string[] = [];
    for (const f of liste) {
      if (f.size > 15 * 1024 * 1024) {
        erreurs.push(`${f.name} : fichier trop lourd (15 Mo au plus).`);
        continue;
      }
      const r = await televerser(dossier, f);
      if ('url' in r) urls.push(r.url);
      else erreurs.push(r.erreur);
    }
    setEnCours(false);
    if (urls.length) onEnvoye(urls);
    if (erreurs.length) setErreur(erreurs[0]);
  };

  return (
    <div className={cn('inline-flex flex-col items-start gap-1', className)}>
      <input
        ref={champ}
        type="file"
        accept={accept}
        multiple={multiple}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => void choisis(e.target.files)}
      />
      <Button variant={variant} size={size} icone={icone ?? <Paperclip />} chargement={enCours} disabled={disabled} onClick={() => champ.current?.click()}>
        {enCours ? 'Envoi…' : libelle}
      </Button>
      {erreur && (
        <p role="alert" className="text-[12px] font-medium text-(--lm-danger)">
          {erreur}
        </p>
      )}
    </div>
  );
}
