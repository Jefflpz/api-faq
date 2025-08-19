const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json()); // ✅ garante que o body será JSON válido

app.post("/chat", async (req, res) => {
  try {
    if (!req.body || !req.body.message) {
      return res.status(400).json({ answer: "Requisição inválida: esperado { message: 'texto' }" });
    }

    const { message } = req.body;

    // Verifica palavras-chave
    const isBiblical = allowedKeywords.some(keyword =>
      message.toLowerCase().includes(keyword)
    );

    if (!isBiblical) {
      return res.json({
        answer: "Não consigo responder perguntas não bíblicas! Se converta, pois Jesus te ama! ❤️"
      });
    }

    // Chama OpenAI
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: message,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Erro da API OpenAI:", errorText);
      return res.status(500).json({ answer: "Erro na API OpenAI", detail: errorText });
    }

    const data = await response.json();
    const outputText = data.output?.[0]?.content?.[0]?.text ?? "Não entendi.";
    res.json({ answer: outputText });

  } catch (e) {
    console.error("Erro no backend:", e);
    res.status(500).json({ answer: "Erro no servidor do backend." });
  }
});

const PORT = 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Backend rodando na porta ${PORT} e acessível na rede`);
});
