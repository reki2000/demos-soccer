// Localised rosters for Japan and Seoul list the family name first.
// All Roman fallback names in these rosters list it last.
export function announcerName(local, roman, familyFirst, fallback = '選手') {
  const words = local?.replace(/（.*$/, '').trim().split(/[\s・]+/);
  if (words?.[0]) return familyFirst ? words[0] : words.at(-1);
  return roman?.trim().split(/\s+/).at(-1) || fallback;
}
