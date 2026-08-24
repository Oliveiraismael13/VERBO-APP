import type { MissionInsight } from "./secondary-missions";

const hebrewScrolls: MissionInsight[] = [
  { kind: "Palavra no original", title: "Aliança", reference: "Vocabulário da Grande Jornada", original: "בְּרִית", transliteration: "berít", meaning: "aliança, compromisso estabelecido", content: "No hebraico bíblico, aponta para uma relação vinculante. É uma palavra-chave para acompanhar a história de Deus com seu povo." },
  { kind: "Palavra no original", title: "Amor leal", reference: "Vocabulário da Grande Jornada", original: "חֶסֶד", transliteration: "chésed", meaning: "amor leal, bondade fiel", content: "Descreve a fidelidade amorosa que permanece. Ela ajuda a ler as promessas de Deus além das circunstâncias do momento." },
  { kind: "Palavra no original", title: "Fidelidade", reference: "Vocabulário da Grande Jornada", original: "אֱמוּנָה", transliteration: "emunáh", meaning: "firmeza, fidelidade, constância", content: "A palavra comunica solidez e confiabilidade. Na jornada bíblica, ela aponta para a firmeza de Deus e para uma resposta confiante." },
  { kind: "Palavra no original", title: "Santo", reference: "Vocabulário da Grande Jornada", original: "קָדוֹשׁ", transliteration: "qadósh", meaning: "separado, santo", content: "No hebraico bíblico, fala da singularidade de Deus e da vida separada para ele." },
  { kind: "Palavra no original", title: "Paz", reference: "Vocabulário da Grande Jornada", original: "שָׁלוֹם", transliteration: "shalóm", meaning: "paz, inteireza, bem-estar", content: "Vai além da ausência de conflito: traz a ideia de vida restaurada, plena e em ordem diante de Deus." },
  { kind: "Palavra no original", title: "Instrução", reference: "Vocabulário da Grande Jornada", original: "תּוֹרָה", transliteration: "toráh", meaning: "instrução, ensino, direção", content: "Pode designar a instrução de Deus para formar e orientar seu povo, não apenas uma regra isolada." },
  { kind: "Palavra no original", title: "Resgatar", reference: "Vocabulário da Grande Jornada", original: "גָּאַל", transliteration: "gaál", meaning: "resgatar, recuperar como parente próximo", content: "Traz a imagem de alguém que intervém para restaurar o que foi perdido. É uma lente importante para a esperança bíblica." },
  { kind: "Palavra no original", title: "Espírito", reference: "Vocabulário da Grande Jornada", original: "רוּחַ", transliteration: "rúach", meaning: "vento, sopro, espírito", content: "A mesma palavra pode comunicar vento e fôlego. No texto bíblico, ela também fala da atuação vivificante de Deus." },
  { kind: "Palavra no original", title: "Justiça", reference: "Vocabulário da Grande Jornada", original: "צֶדֶק", transliteration: "tsédeq", meaning: "justiça, retidão", content: "Aponta para o que está reto e conforme ao caráter de Deus, tanto na vida pessoal quanto nas relações." },
  { kind: "Palavra no original", title: "Esperança", reference: "Vocabulário da Grande Jornada", original: "תִּקְוָה", transliteration: "tiqváh", meaning: "esperança, expectativa", content: "Expressa uma espera voltada para o futuro que Deus promete, mesmo em tempos de ruína." },
];

const greekScrolls: MissionInsight[] = [
  { kind: "Palavra no original", title: "Palavra", reference: "Vocabulário da Grande Jornada", original: "λόγος", transliteration: "lógos", meaning: "palavra, mensagem, expressão", content: "No grego bíblico, pode indicar palavra falada, mensagem ou declaração. No Evangelho de João, ganha profundidade especial ao falar de Cristo." },
  { kind: "Palavra no original", title: "Graça", reference: "Vocabulário da Grande Jornada", original: "χάρις", transliteration: "cháris", meaning: "favor, graça, dádiva", content: "Expressa favor concedido. No Novo Testamento, destaca o agir generoso de Deus que não é conquistado por mérito." },
  { kind: "Palavra no original", title: "Fé", reference: "Vocabulário da Grande Jornada", original: "πίστις", transliteration: "pístis", meaning: "fé, confiança, fidelidade", content: "Traz a ideia de confiança firme. Pode descrever tanto a fé de quem responde a Deus quanto a fidelidade que sustenta essa resposta." },
  { kind: "Palavra no original", title: "Amor", reference: "Vocabulário da Grande Jornada", original: "ἀγάπη", transliteration: "agápe", meaning: "amor, cuidado que busca o bem do outro", content: "No uso cristão, aponta para um amor que se entrega e procura o bem do outro, moldado pelo caráter de Deus." },
  { kind: "Palavra no original", title: "Reino", reference: "Vocabulário da Grande Jornada", original: "βασιλεία", transliteration: "basileía", meaning: "reino, governo, reinado", content: "Não fala apenas de um lugar, mas também do governo ativo de Deus que chega e transforma a vida." },
  { kind: "Palavra no original", title: "Discípulo", reference: "Vocabulário da Grande Jornada", original: "μαθητής", transliteration: "mathētḗs", meaning: "aprendiz, aluno, discípulo", content: "Designa quem aprende seguindo um mestre. Na Grande Jornada, lembra que ler é também aprender a caminhar com Jesus." },
  { kind: "Palavra no original", title: "Salvação", reference: "Vocabulário da Grande Jornada", original: "σωτηρία", transliteration: "sōtēría", meaning: "salvação, livramento, preservação", content: "No grego bíblico, pode carregar a ideia de livramento e restauração. O Novo Testamento a relaciona à obra salvadora de Deus." },
  { kind: "Palavra no original", title: "Justiça", reference: "Vocabulário da Grande Jornada", original: "δικαιοσύνη", transliteration: "dikaiosýnē", meaning: "justiça, retidão", content: "Fala daquilo que é reto diante de Deus e, no Novo Testamento, da justiça que ele concede e forma em seu povo." },
  { kind: "Palavra no original", title: "Paz", reference: "Vocabulário da Grande Jornada", original: "εἰρήνη", transliteration: "eirḗnē", meaning: "paz, reconciliação, bem-estar", content: "No Novo Testamento, muitas vezes carrega a plenitude de paz ligada à reconciliação com Deus e com o próximo." },
  { kind: "Palavra no original", title: "Espírito", reference: "Vocabulário da Grande Jornada", original: "πνεῦμα", transliteration: "pneûma", meaning: "sopro, vento, espírito", content: "Pode designar vento ou sopro. No contexto cristão, é a palavra usada para falar do Espírito Santo." },
  { kind: "Palavra no original", title: "Esperança", reference: "Vocabulário da Grande Jornada", original: "ἐλπίς", transliteration: "elpís", meaning: "esperança, expectativa confiante", content: "No grego bíblico, aponta para uma expectativa voltada ao futuro de Deus, não para um desejo incerto." },
  { kind: "Palavra no original", title: "Vida", reference: "Vocabulário da Grande Jornada", original: "ζωή", transliteration: "zōḗ", meaning: "vida, vida plena", content: "No Novo Testamento, frequentemente descreve a vida recebida de Deus e marcada por comunhão com ele." },
];

function indexFor(slug: string, chapter: number, total: number) {
  return Array.from(slug).reduce((value, character) => value + character.charCodeAt(0), chapter) % total;
}

export function mainMissionScrollForChapter(slug: string, chapter: number, testament: "old" | "new") {
  const collection = testament === "old" ? hebrewScrolls : greekScrolls;
  return collection[indexFor(slug, chapter, collection.length)];
}
