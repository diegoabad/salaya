/** Genera slug URL-safe a partir de un nombre (ES). */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Variantes si el slug está tomado. */
export function suggestSlugs(base: string, zona?: string): string[] {
  const root = slugify(base) || "sala";
  const suggestions = [root];
  if (zona) {
    suggestions.push(slugify(`${base}-${zona}`));
  }
  suggestions.push(`${root}-ensayo`, `${root}-musica`, `${root}-1`);
  return [...new Set(suggestions.filter(Boolean))];
}
