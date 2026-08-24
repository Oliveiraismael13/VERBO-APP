export type SecondaryMission = {
  id: string;
  title: string;
  subtitle: string;
  bookSlug: string;
  from: number;
  to: number;
  cost: number;
  completionXp: number;
  completionCoins: number;
  introduction: string;
  historicalContext: string;
  discovery: string;
  next: string;
};

export const secondaryMissions: SecondaryMission[] = [{
  id: "sermao-do-monte",
  title: "Sermão do Monte",
  subtitle: "O Reino que transforma o coração",
  bookSlug: "mat",
  from: 5,
  to: 7,
  cost: 400,
  completionXp: 80,
  completionCoins: 8,
  introduction: "Em uma montanha da Galileia, Jesus forma seus discípulos para uma vida moldada pelo Reino. Não é uma lista para conquistar Deus, mas o retrato de quem foi alcançado por sua graça.",
  historicalContext: "Mateus apresenta Jesus como o Rei prometido. Nos capítulos 5 a 7, ele revela a justiça do Reino: uma fé que alcança motivações, relações, oração, confiança e obediência.",
  discovery: "O Sermão do Monte mostra que a verdadeira vida diante de Deus nasce de um coração renovado e encontra seu alicerce na palavra de Cristo.",
  next: "Leve a leitura para a prática: ouça as palavras de Jesus e construa sobre a rocha.",
}];

export function secondaryMissionById(id: string) {
  return secondaryMissions.find((mission) => mission.id === id) || null;
}

export function secondaryMissionProgress(mission: SecondaryMission, completed: string[]) {
  const completedSet = new Set(completed);
  const total = mission.to - mission.from + 1;
  const done = Array.from({ length: total }, (_, index) => completedSet.has(`${mission.bookSlug}:${mission.from + index}`)).filter(Boolean).length;
  return { done, total, percent: total ? Math.round(done / total * 100) : 0 };
}
