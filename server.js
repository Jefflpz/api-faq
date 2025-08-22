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
  "biblia", "jesus", "deus", "cristo", "evangelho",
  "discipulos", "cristianismo", "igreja", "oracao",
  "fe", "salvacao", "parabola", "profeta", "apostolo",
  "mandamentos", "batismo", "ressurreicao", "milagre",
  "espirito santo", "perdao", "pecado", "graca"
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
