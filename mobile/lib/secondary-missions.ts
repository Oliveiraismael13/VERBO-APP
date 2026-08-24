export type MissionInsight = { kind: "Expressão" | "Curiosidade"; title: string; reference: string; content: string };

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
      { kind: "Expressão", title: "Bem-aventurados", reference: "Mateus 5:3", content: "A palavra usada no texto transmite mais que uma alegria passageira: descreve a condição de quem é alcançado pelo favor de Deus." },
      { kind: "Curiosidade", title: "Sal e luz", reference: "Mateus 5:13–16", content: "O sal era parte comum da vida diária, usado para dar sabor e ajudar na conservação. Jesus usa imagens simples e visíveis para falar de uma fé que alcança o mundo." },
    ],
    6: [
      { kind: "Expressão", title: "Hipócritas", reference: "Mateus 6:2", content: "O termo grego podia ser usado para atores. Aqui, Jesus critica a prática religiosa feita para ser vista, como se a devoção fosse uma apresentação." },
      { kind: "Curiosidade", title: "Mamom", reference: "Mateus 6:24", content: "A expressão se refere às riquezas ou posses quando elas passam a ocupar o lugar de senhor. O contraste de Jesus não é entre ter bens e adorar a Deus, mas entre dois mestres." },
    ],
    7: [
      { kind: "Expressão", title: "A porta estreita", reference: "Mateus 7:13–14", content: "Jesus fala de dois caminhos para destacar que segui-lo envolve uma decisão real. A imagem aponta para direção e prática, não apenas conhecimento." },
      { kind: "Curiosidade", title: "Casa sobre a rocha", reference: "Mateus 7:24–27", content: "O sermão termina retomando seu tema central: ouvir as palavras de Jesus precisa conduzir à prática. A rocha é a obediência que permanece quando chegam as tempestades." },
    ],
  },
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
