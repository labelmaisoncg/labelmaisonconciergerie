/**
 * Typographie française dans les fichiers sources : les textes qui peuvent
 * s'afficher ou s'envoyer (chaînes et textes JSX, sans le code ni les
 * commentaires). Partagé par verifier-comptes-proprietaires.ts et
 * verifier-demandes-proprietaires.ts. Module pur, sans dépendance.
 */

/**
 * Chaînes (', ", `) et textes JSX d'un fichier source, sans le code des ${…}
 * ni les commentaires : ce qui peut s'afficher ou s'envoyer.
 */
export function textesDuSource(source: string): string[] {
  const textes: string[] = [];
  const ajouter = (t: string) => {
    if (/[A-Za-zÀ-ÿ]/.test(t)) textes.push(t);
  };
  type Mode = 'code' | 'str1' | 'str2' | 'tpl' | 'ligne' | 'bloc';
  let mode: Mode = 'code';
  // Profondeur d'accolades de chaque ${…} ouvert (gabarits imbriqués).
  const expressions: number[] = [];
  let tampon = '';
  let jsx: string | null = null;
  let i = 0;
  while (i < source.length) {
    const c = source[i];
    const d = source[i + 1];
    if (mode === 'ligne') {
      if (c === '\n') mode = 'code';
      i++;
      continue;
    }
    if (mode === 'bloc') {
      if (c === '*' && d === '/') {
        mode = 'code';
        i += 2;
      } else i++;
      continue;
    }
    if (mode === 'str1' || mode === 'str2') {
      const fin = mode === 'str1' ? "'" : '"';
      if (c === '\\') {
        tampon += d ?? '';
        i += 2;
        continue;
      }
      if (c === fin || c === '\n') {
        ajouter(tampon);
        tampon = '';
        mode = 'code';
        i++;
        continue;
      }
      tampon += c;
      i++;
      continue;
    }
    if (mode === 'tpl') {
      if (c === '\\') {
        tampon += d ?? '';
        i += 2;
        continue;
      }
      if (c === '`') {
        ajouter(tampon);
        tampon = '';
        mode = 'code';
        i++;
        continue;
      }
      if (c === '$' && d === '{') {
        ajouter(tampon);
        tampon = '';
        expressions.push(0);
        mode = 'code';
        i += 2;
        continue;
      }
      tampon += c;
      i++;
      continue;
    }
    // Code.
    if (c === '/' && d === '/') {
      mode = 'ligne';
      i += 2;
      continue;
    }
    if (c === '/' && d === '*') {
      mode = 'bloc';
      i += 2;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      mode = c === "'" ? 'str1' : c === '"' ? 'str2' : 'tpl';
      jsx = null;
      i++;
      continue;
    }
    if (expressions.length) {
      if (c === '{') expressions[expressions.length - 1]++;
      else if (c === '}') {
        if (expressions[expressions.length - 1] === 0) {
          expressions.pop();
          mode = 'tpl';
          i++;
          continue;
        }
        expressions[expressions.length - 1]--;
      }
    }
    // Texte JSX : entre « > » et « < », sans expression ni code.
    if (jsx !== null) {
      if (c === '<') {
        if (!/[;()=]/.test(jsx)) ajouter(jsx);
        jsx = null;
      } else if (c === '{') jsx = null;
      else jsx += c;
    }
    if (c === '>') jsx = '';
    i++;
  }
  return textes;
}

/** Textes où « ? » ou « : » suit un espace simple au lieu d'un espace insécable (typographie française) ; un morceau de gabarit qui commence par « : » compte aussi. */
export const textesAvecEspaceSimple = (source: string): string[] => textesDuSource(source).filter((t) => /(^|\S) [?:]/.test(t));
