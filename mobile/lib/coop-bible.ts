export const coopBibleBooks = [
  ["gen", 50], ["exod", 40], ["lev", 27], ["num", 36], ["deut", 34], ["jos", 24], ["juiz", 21], ["rute", 4], ["1sa", 31], ["2sa", 24], ["1rs", 22], ["2rs", 25], ["1crn", 29], ["2crn", 36], ["esd", 10], ["nee", 13], ["est", 10], ["jo", 42], ["sal", 150], ["prov", 31], ["ecl", 12], ["cant", 8], ["isa", 66], ["jer", 52], ["lam", 5], ["eze", 48], ["dan", 12], ["ose", 14], ["joel", 3], ["amos", 9], ["oba", 1], ["jon", 4], ["miq", 7], ["naum", 3], ["hab", 3], ["sof", 3], ["ageu", 2], ["zac", 14], ["mal", 4],
  ["mat", 28], ["mar", 16], ["luc", 24], ["joao", 21], ["atos", 28], ["rom", 16], ["1cor", 16], ["2cor", 13], ["gal", 6], ["efes", 6], ["fil", 4], ["col", 4], ["1tes", 5], ["2tes", 3], ["1tim", 6], ["2tim", 4], ["tito", 3], ["flm", 1], ["heb", 13], ["tiag", 5], ["1ped", 5], ["2ped", 3], ["1joao", 5], ["2joao", 1], ["3joao", 1], ["jud", 1], ["apo", 22],
] as const;

export type CoopReference = { bookSlug: string; chapter: number };
const bookIndex = new Map(coopBibleBooks.map(([slug, chapters], index) => [slug, { index, chapters }]));

export function isCoopReference(value: unknown, chapter: unknown): value is string {
  const book = typeof value === "string" ? bookIndex.get(value) : undefined;
  return Boolean(book && Number.isInteger(chapter) && Number(chapter) >= 1 && Number(chapter) <= book.chapters);
}
export function compareCoopReferences(left: CoopReference, right: CoopReference) {
  const leftBook = bookIndex.get(left.bookSlug); const rightBook = bookIndex.get(right.bookSlug);
  if (!leftBook || !rightBook) return NaN;
  return leftBook.index === rightBook.index ? left.chapter - right.chapter : leftBook.index - rightBook.index;
}
export function nextCoopReference(reference: CoopReference): CoopReference | null {
  const book = bookIndex.get(reference.bookSlug);
  if (!book) return null;
  if (reference.chapter < book.chapters) return { bookSlug: reference.bookSlug, chapter: reference.chapter + 1 };
  const next = coopBibleBooks[book.index + 1];
  return next ? { bookSlug: next[0], chapter: 1 } : null;
}
