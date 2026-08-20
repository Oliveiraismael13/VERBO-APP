export const XP_CONFIG = Object.freeze({ maxLevel: 50, bibleChapters: 1189, xpPerChapter: 40, curveExponent: 1.65 });
export const TOTAL_BIBLE_XP = XP_CONFIG.bibleChapters * XP_CONFIG.xpPerChapter;
export function discipleTitle(level) {
  if (level >= 50) return '👑 Guardião da Verdade';
  if (level >= 40) return 'Ancião da Palavra';
  if (level >= 30) return 'Erudito das Escrituras';
  if (level >= 20) return 'Mestre da Lei';
  if (level >= 10) return 'Leitor das Escrituras';
  return 'Aprendiz';
}
export function xpForLevel(level) {
  const boundedLevel = Math.min(Math.max(Math.floor(level), 1), XP_CONFIG.maxLevel);
  if (boundedLevel === 1) return 0;
  if (boundedLevel === XP_CONFIG.maxLevel) return TOTAL_BIBLE_XP;
  const progress = (boundedLevel - 1) / (XP_CONFIG.maxLevel - 1);
  return Math.round(TOTAL_BIBLE_XP * progress ** XP_CONFIG.curveExponent);
}
export function levelForXp(xp) {
  const safeXp = Math.max(0, xp);
  for (let level = XP_CONFIG.maxLevel; level >= 1; level -= 1) if (safeXp >= xpForLevel(level)) return level;
  return 1;
}
export function getXpProgress(xp) {
  const level = levelForXp(xp);
  const currentLevelXp = xpForLevel(level);
  const nextLevelXp = level === XP_CONFIG.maxLevel ? TOTAL_BIBLE_XP : xpForLevel(level + 1);
  const current = Math.min(Math.max(xp, currentLevelXp), nextLevelXp);
  const needed = nextLevelXp - currentLevelXp;
  const progress = level === XP_CONFIG.maxLevel ? 100 : Math.round(((current - currentLevelXp) / needed) * 100);
  return { level, current, nextLevelXp, currentLevelXp, needed, remaining: nextLevelXp - current, progress, isMaxLevel: level === XP_CONFIG.maxLevel };
}