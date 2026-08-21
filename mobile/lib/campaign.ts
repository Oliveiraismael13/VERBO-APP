export type CampaignRange = { slug: string; from: number; to: number };
export type CampaignMission = CampaignRange & { title: string };
export type CampaignAct = { number: number; title: string; ranges: CampaignRange[]; missions: CampaignMission[] };
export type MissionNarrative = { introduction: string; reflection: string; discovery: string; next: string };

const range = (slug: string, from: number, to: number): CampaignRange => ({ slug, from, to });
const mission = (slug: string, from: number, to: number, title: string): CampaignMission => ({ slug, from, to, title });

export const dailyReferences = [
  { slug: "joao", chapter: 3, verse: 16 },
  { slug: "sal", chapter: 23, verse: 1 },
  { slug: "rom", chapter: 8, verse: 28 },
  { slug: "fil", chapter: 4, verse: 13 },
  { slug: "isa", chapter: 41, verse: 10 },
] as const;

export const campaignActs: CampaignAct[] = [
  {
    number: 1,
    title: "O Princípio da Promessa",
    ranges: [range("gen", 1, 11)],
    missions: [mission("gen", 1, 1, "A Luz sobre o Abismo"), mission("gen", 2, 3, "O Jardim e a Escolha"), mission("gen", 4, 5, "A Terra Ferida"), mission("gen", 6, 9, "As Águas da Memória"), mission("gen", 10, 11, "A Torre dos Homens")],
  },
  {
    number: 2,
    title: "A Família da Aliança",
    ranges: [range("gen", 12, 50)],
    missions: [mission("gen", 12, 23, "O Chamado de Abraão"), mission("gen", 24, 36, "A Promessa entre Gerações"), mission("gen", 37, 50, "José e o Recomeço")],
  },
  {
    number: 3,
    title: "O Caminho da Libertação",
    ranges: [range("exod", 1, 40), range("lev", 1, 27), range("num", 1, 36), range("deut", 1, 34)],
    missions: [mission("exod", 1, 15, "A Noite da Partida"), mission("exod", 16, 40, "A Montanha da Aliança"), mission("lev", 1, 27, "Um Povo Separado"), mission("num", 1, 36, "O Deserto da Incredulidade"), mission("deut", 1, 34, "As Palavras de Moisés")],
  },
  {
    number: 4,
    title: "Terra, Reino e Ruína",
    ranges: [range("jos", 1, 24), range("juiz", 1, 21), range("rute", 1, 4), range("1sa", 1, 31), range("2sa", 1, 24), range("1rs", 1, 22), range("2rs", 1, 25), range("1crn", 1, 29), range("2crn", 1, 36), range("esd", 1, 10), range("nee", 1, 13), range("est", 1, 10)],
    missions: [mission("jos", 1, 24, "A Terra à Vista"), mission("juiz", 1, 21, "O Ciclo dos Juízes"), mission("rute", 1, 4, "Uma Estrangeira na Linhagem"), mission("1sa", 1, 31, "O Reino Escolhido"), mission("2sa", 1, 24, "A Casa de Davi"), mission("1rs", 1, 22, "O Reino Dividido"), mission("2rs", 1, 25, "A Queda e o Exílio"), mission("1crn", 1, 29, "Memória dos Reis"), mission("2crn", 1, 36, "A Ruína de Jerusalém"), mission("esd", 1, 10, "O Retorno"), mission("nee", 1, 13, "Muros Reconstruídos"), mission("est", 1, 10, "Providência no Exílio")],
  },
  {
    number: 5,
    title: "O Silêncio e a Esperança",
    ranges: [range("jo", 1, 42), range("sal", 1, 150), range("prov", 1, 31), range("ecl", 1, 12), range("cant", 1, 8), range("isa", 1, 66), range("jer", 1, 52), range("lam", 1, 5), range("eze", 1, 48), range("dan", 1, 12), range("ose", 1, 14), range("joel", 1, 3), range("amos", 1, 9), range("oba", 1, 1), range("jon", 1, 4), range("miq", 1, 7), range("naum", 1, 3), range("hab", 1, 3), range("sof", 1, 3), range("ageu", 1, 2), range("zac", 1, 14), range("mal", 1, 4)],
    missions: [mission("jo", 1, 42, "Quando o Justo Sofre"), mission("sal", 1, 150, "Cânticos no Escuro"), mission("prov", 1, 31, "O Peso da Sabedoria"), mission("isa", 1, 66, "A Voz do Profeta"), mission("mal", 1, 4, "O Último Mensageiro")],
  },
  {
    number: 6,
    title: "O Verbo entre Nós",
    ranges: [range("mat", 1, 28), range("mar", 1, 16), range("luc", 1, 24), range("joao", 1, 21)],
    missions: [mission("mat", 1, 28, "O Rei Prometido"), mission("mar", 1, 16, "O Servo no Caminho"), mission("luc", 1, 24, "O Rosto dos Perdidos"), mission("joao", 1, 21, "O Verbo da Vida")],
  },
  {
    number: 7,
    title: "Até os Confins",
    ranges: [range("atos", 1, 28), range("rom", 1, 16), range("1cor", 1, 16), range("2cor", 1, 13), range("gal", 1, 6), range("efes", 1, 6), range("fil", 1, 4), range("col", 1, 4), range("1tes", 1, 5), range("2tes", 1, 3), range("1tim", 1, 6), range("2tim", 1, 4), range("tito", 1, 3), range("flm", 1, 1), range("heb", 1, 13), range("tiag", 1, 5), range("1ped", 1, 5), range("2ped", 1, 3), range("1joao", 1, 5), range("2joao", 1, 1), range("3joao", 1, 1), range("jud", 1, 1), range("apo", 1, 22)],
    missions: [mission("atos", 1, 28, "O Espírito e a Estrada"), mission("rom", 1, 16, "Uma Justiça que Alcança Todos"), mission("1cor", 1, 16, "Uma Comunidade em Construção"), mission("heb", 1, 13, "Uma Esperança Melhor"), mission("apo", 1, 22, "A Nova Criação")],
  },
];

export function missionForChapter(slug: string, chapter: number) {
  for (const act of campaignActs) {
    const found = act.missions.find((item) => item.slug === slug && chapter >= item.from && chapter <= item.to);
    if (found) return { act, mission: found };
  }
  return null;
}

const narratives: Record<string, MissionNarrative> = {
  "gen:1-1": {
    introduction: "Antes de cidades, reis e povos, a história começa com Deus criando e chamando o mundo de bom. Leia devagar: cada detalhe prepara a grande história que virá.",
    reflection: "O que o texto mostra sobre Deus antes de falar sobre a humanidade?",
    discovery: "Você encontrou a primeira peça da história: o mundo nasce da palavra e da bondade de Deus.",
    next: "Mas um mundo bom ainda guarda uma pergunta: como viver nele? O jardim espera.",
  },
  "gen:2-3": {
    introduction: "O cenário agora se aproxima. No jardim, confiança, responsabilidade e escolha passam a ocupar o centro da história.",
    reflection: "Onde o texto apresenta liberdade, limite e confiança?",
    discovery: "A ruptura não começa longe; ela alcança o coração humano e suas relações.",
    next: "Fora do jardim, a história continua — e a ferida aparece entre irmãos.",
  },
  "gen:4-5": {
    introduction: "Depois da ruptura, a pergunta se torna concreta: o que acontece quando o pecado atravessa uma família e uma geração?",
    reflection: "Que responsabilidade o texto apresenta quando fala do outro?",
    discovery: "A violência não é tratada como detalhe; ela revela a profundidade da ruptura.",
    next: "A terra se enche, mas a história ainda precisa de um recomeço.",
  },
  "gen:6-9": {
    introduction: "Em meio à violência, Noé aparece como parte de uma história de juízo, preservação e aliança — não como um escape da gravidade do texto.",
    reflection: "Quais sinais de juízo e de preservação aparecem nesta leitura?",
    discovery: "Mesmo diante do juízo, a aliança aponta para a paciência e a fidelidade de Deus.",
    next: "Depois das águas, a humanidade ainda tentará construir um nome para si.",
  },
  "gen:10-11": {
    introduction: "Povos, línguas e uma torre: a história agora olha para a ambição humana e para a dispersão das nações.",
    reflection: "O que as pessoas em Babel desejam construir para si mesmas?",
    discovery: "A dispersão encerra este primeiro ato, mas a promessa está prestes a tomar a forma de uma família.",
    next: "Um chamado a Abrão abrirá o próximo capítulo da Grande História.",
  },
};

export function narrativeForMission(mission: CampaignMission): MissionNarrative {
  const key = `${mission.slug}:${mission.from}-${mission.to}`;
  return narratives[key] ?? {
    introduction: `Nesta parte da Grande História, ${mission.title.toLowerCase()} conduz a leitura de ${mission.from === mission.to ? "um capítulo" : "uma nova sequência de capítulos"}. Observe o texto antes de tirar conclusões apressadas.`,
    reflection: "Que parte do texto ajuda você a compreender melhor o que veio antes?",
    discovery: "Cada leitura amplia a compreensão da história bíblica e do lugar deste trecho nela.",
    next: "A próxima etapa revelará uma nova consequência e uma nova pergunta para acompanhar.",
  };
}
