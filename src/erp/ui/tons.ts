/** Tons sémantiques partagés par Badge, Stat, Alert, ProgressBar, Timeline. */
export type Ton = 'neutre' | 'or' | 'succes' | 'alerte' | 'danger' | 'info';

/** Fond lavé + texte coloré (badges, pastilles). */
export const TON_LAVIS: Record<Ton, string> = {
  neutre: 'bg-(--lm-neutre-lavis) text-(--lm-encre-2)',
  or: 'bg-(--lm-or-lavis) text-(--lm-brun)',
  succes: 'bg-(--lm-succes-lavis) text-(--lm-succes)',
  alerte: 'bg-(--lm-alerte-lavis) text-(--lm-alerte)',
  danger: 'bg-(--lm-danger-lavis) text-(--lm-danger)',
  info: 'bg-(--lm-info-lavis) text-(--lm-info)',
};

/** Couleur pleine (points, barres, filets). */
export const TON_PLEIN: Record<Ton, string> = {
  neutre: 'bg-(--lm-encre-3)',
  or: 'bg-(--lm-or)',
  succes: 'bg-(--lm-succes)',
  alerte: 'bg-(--lm-alerte)',
  danger: 'bg-(--lm-danger)',
  info: 'bg-(--lm-info)',
};

export const TON_TEXTE: Record<Ton, string> = {
  neutre: 'text-(--lm-encre-2)',
  or: 'text-(--lm-or)',
  succes: 'text-(--lm-succes)',
  alerte: 'text-(--lm-alerte)',
  danger: 'text-(--lm-danger)',
  info: 'text-(--lm-info)',
};
