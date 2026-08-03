/** Wandelt einen Anzeigenamen in einen URL-sicheren Slug um, z.B. "Dawid Faith" wird zu "dawid-faith". */
export function slugify(name: string): string {
  const combiningMarks = new RegExp('[̀-ͯ]', 'g');
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(combiningMarks, '') // Umlaute/Akzente auf Basisbuchstaben reduzieren
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
