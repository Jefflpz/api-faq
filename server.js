import express from "express";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
import pkg from "pg";

dotenv.config();
const { Pool } = pkg;

const app = express();
app.use(express.json());

// Config do banco PostgreSQL
const db = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 5432,
  ssl: {
    rejectUnauthorized: false
  },
});

// Config Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

app.post("/pergunta", async (req, res) => {
  try {

    const { pergunta } = req.body;
    if (!pergunta) {
      return res.status(400).json({ answer: "Pergunta obrigatória" });
    }

    const prompt = `Você é um assistente de respostas rápidas. Responda em uma frase de no máximo 5 palavras, de forma direta: ${pergunta}`;
    const result = await model.generateContent(prompt);

    const respostaIA = result.response.text();

    await db.query(
        "CALL inserir_deletar_antiga ($1, $2)",
        [pergunta, respostaIA]
    );

    res.json({ answer: `${pergunta}:${respostaIA}` });

  } catch (error) {
    console.error("Erro detalhado:", error.message);
    res.status(500).json({ answer: "Erro interno ao processar sua pergunta." });
  }
});

app.listen(3000, () => {
  console.log("Servidor rodando na porta 3000");
});
