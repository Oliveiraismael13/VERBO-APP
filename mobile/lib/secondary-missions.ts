export type MissionInsight = { kind: "Palavra no original"; title: string; reference: string; original: string; transliteration: string; meaning: string; content: string };

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
  insights: Record<number, MissionInsight[]>;
  hiddenInsight?: { chapter: number; insight: MissionInsight; requirements: ("favorite" | "notes-two")[] };
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
  insights: {
    5: [
      { kind: "Palavra no original", title: "Bem-aventurados", reference: "Mateus 5:3", original: "μακάριοι", transliteration: "makárioi", meaning: "abençoados; em condição de favor divino", content: "No grego bíblico, aponta para quem é reconhecido como feliz por Deus — não para uma emoção passageira." },
    ],
    6: [
      { kind: "Palavra no original", title: "Hipócritas", reference: "Mateus 6:2", original: "ὑποκριταί", transliteration: "hypokritaí", meaning: "atores; quem desempenha um papel diante de uma plateia", content: "No uso bíblico, Jesus aplica a palavra à devoção encenada para receber a aprovação das pessoas." },
    ],
    7: [
      { kind: "Palavra no original", title: "A porta estreita", reference: "Mateus 7:13–14", original: "στενὴ ἡ πύλη", transliteration: "stenē hē pýlē", meaning: "estreita, apertada, é a porta", content: "A expressão forma uma imagem de passagem limitada e torna concreta a escolha de seguir Jesus com decisão e prática." },
    ],
  },
  hiddenInsight: { chapter: 6, requirements: ["favorite", "notes-two"], insight: { kind: "Palavra no original", title: "Mamom", reference: "Mateus 6:24", original: "μαμωνᾶς", transliteration: "mamōnás", meaning: "riqueza, bens, propriedade", content: "A forma grega preserva uma palavra semítica. No texto, riqueza aparece como um possível senhor que disputa lealdade com Deus." } },
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
