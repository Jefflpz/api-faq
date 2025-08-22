import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

// Função para normalizar texto (remove acentos e pontuação)
const normalizeText = (text) => {
  return text
    .normalize("NFD") // separa caracteres de acento
    .replace(/[\u0300-\u036f]/g, "") // remove marcas de acento
    .toLowerCase()
    .replace(/[.,!?;:()]/g, ""); // remove pontuação
};

// Lista de palavras-chave para identificar perguntas bíblicas
  const allowedKeywords = [
  // Termos gerais e espirituais
  "bíblia", "biblia", "livro sagrado", "jesus", "yeshua", "iesus",
  "jesus cristo", "cristo jesus", "cristo", "messias", "salvador",
  "senhor", "deus", "yahweh", "yahvé", "yahveh", "yhwh", "jeová",
  "jehova", "el shaddai", "adonai", "senhor dos exércitos",
  "espírito santo", "espirito santo", "espírito de deus",
  "espirito de deus", "santo espírito", "santo espirito",
  "evangelho", "boa nova", "boas novas",
  "discípulos", "discipulos", "seguidores de jesus",
  "apóstolos", "apostolos", "igreja", "ekklesia",
  "templo", "congregação", "ministerio", "ministério",
  "pastor", "obreiro", "missionário", "evangelista",
  "bispo", "presbítero", "oração", "oracao",
  "clamar", "intercessão", "intercessao",
  "fé", "fe", "crença", "crenca",
  "confiança em deus", "graça", "graca", "favor imerecido",
  "salvação", "salvacao", "redenção", "redencao",
  "pecado", "transgressão", "iniquidade", "arrependimento",
  "converter-se", "confissão", "confissao", "perdão",
  "perdao", "misericórdia", "misericordia", "santidade",
  "pureza", "justiça", "justica", "retidão", "retidao",
  "ressurreição", "ressurreicao", "vida eterna", "vida nova",
  "cruz", "madeiro", "sacrifício", "sacrificio",
  "cordeiro de deus", "aliança", "alianca",
  "novo pacto", "antigo pacto", "batismo", "batizar",
  "imersão", "ceia do senhor", "santa ceia", "eucaristia",
  "adoração", "adoracao", "louvor", "exaltação", "exaltacao",
  "profecia", "profeta", "profetizar", "oráculo",
  "evangelizar", "pregar", "missão", "missao",
  "pregação", "pregacao", "discipulado", "seguimento",
  "reino de deus", "reino dos céus", "arrebatamento",
  "arrebatamento da igreja", "justificação", "justificacao",
  "santificação", "santificacao", "mediador",
  "sumo sacerdote", "advogado fiel",

  // Teologia e conceitos
  "trindade", "triunidade", "onipotência", "onipotencia",
  "todo-poderoso", "onisciência", "onisciencia",
  "todo-sabedor", "onipresença", "onipresenca",
  "soteriologia", "escatologia", "angelologia",
  "demonologia", "doutrina", "dogma",
  "confissão de fé", "confissao de fe",
  "parábola", "parabola", "ensinos de jesus",
  "milagre", "sinal", "maravilha",

  // Variações de nomes de personagens
  "abraão", "abraao", "abraham", "israel",
  "jacó", "jaco", "yaakov", "moisés", "moises",
  "moshe", "davi", "daví", "david", "salomão",
  "salomao", "shlomo", "joão batista", "joao batista",
  "yohanan", "pedro", "simão", "simao", "cefas",
  "paulo", "saulo", "apostolo paulo",
  "maria", "miryam", "virgem maria",
  "jesus de nazaré", "jesus de nazare",
  "cristo redentor",

  // Livros da Bíblia
  "gênesis", "genesis", "êxodo", "exodo",
  "levítico", "levitico", "números", "numeros",
  "deuteronômio", "deuteronomio", "salmos",
  "salmista", "salmo", "provérbios", "proverbios",
  "cânticos", "canticos", "cantares", "eclesiastes",
  "pregador", "apocalipse", "revelação", "revelacao",

  // Termos relacionados às Escrituras
  "palavra de deus", "sagrada escritura",
  "escrituras sagradas", "lei", "torá",
  "pentateuco", "profecia", "oráculo",
  "mensagem divina", "mandamentos",
  "dez mandamentos",

  // Objetos e símbolos
  "arca da aliança", "arca da alianca",
  "arca do senhor", "tabernáculo", "tabernaculo",
  "templo", "templo de salomão", "templo de salomao",
  "maná", "mana", "pão do céu", "pao do ceu",
  "sarça ardente", "sarça", "sarça que queimava",
  "sarsa ardente", "estrela de belém",
  "estrela de belem", "coroa de espinhos",
  "coroa", "espinhos", "monte sinai",
  "monte horebe", "monte sião", "monte siao",
  "monte das oliveiras", "rio jordão", "rio jordao",
  "galileia", "galiléia", "jerusalém", "jerusalem",
  "belém", "belem", "nazaré", "nazare",
  "canaã", "canaa", "terra prometida",

  // Anjos e seres espirituais
  "miguel", "arcanjo miguel", "gabriel",
  "anjo gabriel", "rafael", "querubim",
  "querubins", "serafim", "serafins",
  "anjos", "anjos do senhor",
  "exército celestial", "exercito celestial",

  // Expressões cristãs curtas e populares
  "jesus salva", "jesus vive", "cristo reina",
  "cristo reina para sempre", "deus é amor",
  "deus e amor", "cristo é a rocha",
  "cristo e a rocha", "glória a deus",
  "gloria a deus", "aleluia", "hallelujah",
  "maranata", "santo santo santo", "paz do senhor",
  "a paz do senhor", "em nome de jesus",
  "em nome de cristo", "amém", "amen",
  "jesus voltará", "jesus voltara",
  "cristo ressuscitou", "palavra viva",
  "caminho verdade e vida",
  "o senhor é meu pastor", "o senhor e meu pastor",
  "tudo posso em cristo", "deus proverá",
  "deus proverá o cordeiro", "ora sem cessar",
  "orai sem cessar"
];


app.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ answer: "Mensagem obrigatória" });

    const normalizedMessage = normalizeText(message);

    // Verifica se alguma palavra-chave está presente
    const isBiblical = allowedKeywords.some(keyword =>
      normalizedMessage.includes(normalizeText(keyword))
    );

    if (!isBiblical) {
      return res.json({ answer: "Não consigo responder perguntas não bíblicas! ❤️" });
    }

    // Simulação de resposta de IA com modelo de resposta estilizado
    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { 
            role: "system", 
            content: 
             `Você é um especialista em teologia cristã.
              Responda sempre em linguagem clara e organizada.
              Estruture as respostas seguindo este padrão:

              1. Introdução breve ao tema.
              2. Explicação detalhada em 2-3 parágrafos.
              3. Conclusão com um resumo ou aplicação prática.

              Quando apropriado, use tópicos para destacar pontos principais.
              Evite jargões teológicos complexos.` 
          },
          { role: "user", content: message }
        ]
      })
    });

    const data = await aiResponse.json();
    const rawAnswer = data.choices?.[0]?.message?.content || "Não consegui encontrar uma resposta adequada.";

    // Resposta formatada (com parágrafos e tópicos)
    const formattedResponse = {
      titulo: "Resposta Bíblica",
      paragrafo_inicial: "Segue uma explicação detalhada baseada na Bíblia:",
      topicos: rawAnswer
        .split("\n")
        .filter(p => p.trim() !== "")
        .map((p, i) => `Tópico ${i + 1}: ${p}`),
      conclusao: "Espero que essa resposta lhe traga clareza espiritual e sabedoria!"
    };

    return res.json({ answer: formattedResponse });

  } catch (error) {
    console.error("Erro no chat:", error);
    res.status(500).json({ answer: "Erro interno ao processar sua pergunta." });
  }
});

app.listen(3000, () => {
  console.log("Servidor rodando na porta 3000");
});
