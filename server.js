const express = require("express");
const cors = require("cors");
const { OpenAI } = require("openai");

const app = express();
app.use(cors());
app.use(express.json());

const OPENAI_KEY = process.env.OPENAI_KEY || "";
const client = new OpenAI({ apiKey: OPENAI_KEY });

// Lista de palavras-chave (mantida)
const allowedKeywords = [
  // ... [SUA LISTA COMPLETA DE PALAVRAS-CHAVE AQUI]
];

app.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ answer: "Mensagem obrigatória" });

    const isBiblical = allowedKeywords.some(keyword => message.toLowerCase().includes(keyword));

    if (!isBiblical) {
      return res.json({ answer: "<p>Não consigo responder perguntas não bíblicas! ❤️</p>" });
    }

    // Chamando a OpenAI pelo SDK
    const response = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content:
            "Responda de forma objetiva, clara e bem estruturada. Utilize apenas HTML para formatar o texto, permitindo apenas as tags: <h2>, <h3>, <p>, <ul>, <li>, <b> e <i>. " +
            "Organize a resposta em parágrafos bem definidos, use listas quando apropriado e destaque termos importantes com negrito ou itálico. " +
            "Quando necessário, inclua emojis para ilustrar ou enfatizar ideias, exemplos de versículos bíblicos 📖 e referências a teólogos renomados."
        },
        { role: "user", content: message }
      ],
      max_tokens: 500
    });

    let outputText = response.choices[0].message.content || "";

    // Limpeza e padronização
    outputText = outputText
      .replace(/\n{2,}/g, "</p><p>") // quebras duplas viram novos parágrafos
      .replace(/\n/g, " ") // remove quebras soltas
      .trim();

    if (!/^<\w+>/.test(outputText)) {
      outputText = `<p>${outputText}</p>`;
    }

    // Adiciona container estilizado
    const finalOutput = `
      <div style="font-family: Arial, sans-serif; color: #f1f1f1; line-height: 1.6;">
        ${outputText}
      </div>
    `;

    res.json({ answer: finalOutput });
  } catch (e) {
    console.error("Erro no backend:", e);
    res.status(500).json({ answer: "<p>Erro no servidor do backend.</p>" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Backend rodando na porta ${PORT}`);
});
