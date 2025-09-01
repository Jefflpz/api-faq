import express from "express";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
import pkg from "pg";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";

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

function hashSenha(senha) {
  const salt = generateSalt();
  const hash = crypto.createHash('sha256');
  hash.update(senha + salt);
  return hash.digest('hex');
}

function hashSenhaComSalt(senha, salt) {
  const hash = crypto.createHash('sha256');
  hash.update(senha + salt);
  return hash.digest('hex');
}

function verificarSenha(senhaFornecida, hashArmazenado, saltArmazenado) {
  const hash = crypto.createHash('sha256');
  hash.update(senhaFornecida + saltArmazenado);
  return hash.digest('hex') === hashArmazenado;
}

function generateSalt() {
  return uuidv4().substring(0, 16);
}

function generateToken() {
  return uuidv4();
}

async function autenticarToken(req, res, next) {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ success: false, message: 'Token de acesso necessário' });
    }

    const result = await db.query(`
      SELECT u.id, u.email, u.nome, s.data_expiracao
      FROM sessoes s
      JOIN usuarios u ON s.id_usuario = u.id
      WHERE s.token_sessao = $1 
      AND s.ativa = true 
      AND s.data_expiracao > CURRENT_TIMESTAMP
    `, [token]);

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Sessão inválida ou expirada' });
    }

    req.user = result.rows[0];
    req.token = token;
    next();
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erro na autenticação' });
  }
}


app.post("/cadastro", async (req, res) => {
  try {
    const { email, senha, nome } = req.body;

    if (!email || !senha || !nome) {
      return res.status(400).json({ success: false, message: 'Email, senha e nome são obrigatórios' });
    }

    const emailResult = await db.query(
        'SELECT id FROM usuarios WHERE email = $1',
        [email]
    );

    if (emailResult.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'Email já cadastrado' });
    }

    // Gera o salt e o hash
    const salt = generateSalt();
    const senhaHash = hashSenhaComSalt(senha, salt); // Nova função

    const insertResult = await db.query(`
      INSERT INTO usuarios (email, senha_hash, salt, nome)
      VALUES ($1, $2, $3, $4)
      RETURNING id, email, nome, data_criacao
    `, [email, senhaHash, salt, nome]); // Armazena também o salt

    if (insertResult.rows.length > 0) {
      res.status(201).json({
        success: true,
        user: {
          id: insertResult.rows[0].id,
          email: insertResult.rows[0].email,
          nome: insertResult.rows[0].nome,
          data_criacao: insertResult.rows[0].data_criacao,
        }
      });
    } else {
      res.status(500).json({ success: false, message: 'Erro ao cadastrar usuário' });
    }
  } catch (error) {
    console.error('Erro no cadastro:', error);
    res.status(500).json({ success: false, message: 'Erro interno do servidor' });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({ success: false, message: 'Email e senha são obrigatórios' });
    }

    const result = await db.query(`
      SELECT id, email, senha_hash, salt, nome, ativo
      FROM usuarios
      WHERE email = $1
    `, [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Usuário não encontrado' });
    }

    if (!result.rows[0].ativo) {
      return res.status(401).json({ success: false, message: 'Usuário desativado' });
    }

    const usuario = result.rows[0];

    // Usa o salt armazenado para gerar o hash da senha fornecida
    const senhaFornecidaHash = hashSenhaComSalt(senha, usuario.salt);
    const senhaArmazenadaHash = usuario.senha_hash;

    console.log('Senha fornecida hash:', senhaFornecidaHash);
    console.log('Senha armazenada hash:', senhaArmazenadaHash);

    if (senhaFornecidaHash !== senhaArmazenadaHash) {
      return res.status(401).json({ success: false, message: 'Senha incorreta' });
    }

    const tokenSessao = generateToken();
    const expiracao = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 dias

    await db.query(`
      INSERT INTO sessoes (id_usuario, token_sessao, data_expiracao)
      VALUES ($1, $2, $3)
    `, [usuario.id, tokenSessao, expiracao]);

    await db.query(`
      UPDATE usuarios
      SET ultimo_login = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [usuario.id]);

    res.json({
      success: true,
      token: tokenSessao,
      user: {
        id: usuario.id,
        email: usuario.email,
        nome: usuario.nome,
      }
    });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ success: false, message: 'Erro interno do servidor' });
  }
});

app.post("/logout", autenticarToken, async (req, res) => {
  try {
    await db.query(`
      UPDATE sessoes 
      SET ativa = false 
      WHERE token_sessao = $1
    `, [req.token]);

    res.json({ success: true, message: 'Logout realizado com sucesso' });
  } catch (error) {
    console.error('Erro no logout:', error);
    res.status(500).json({ success: false, message: 'Erro interno do servidor' });
  }
});

app.post("/solicitar-redefinicao-senha", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email é obrigatório' });
    }

    const token = generateToken();
    const expiracao = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    const result = await db.query(`
      UPDATE usuarios 
      SET token_recuperacao = $1, expiracao_token = $2
      WHERE email = $3
      RETURNING id
    `, [token, expiracao, email]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Email não encontrado' });
    }

    console.log('Token de recuperação:', token);

    res.json({
      success: true,
      message: 'Email de recuperação enviado (token no console)'
    });
  } catch (error) {
    console.error('Erro ao solicitar redefinição:', error);
    res.status(500).json({ success: false, message: 'Erro interno do servidor' });
  }
});

app.post("/redefinir-senha", async (req, res) => {
  try {
    const { token, novaSenha } = req.body;

    if (!token || !novaSenha) {
      return res.status(400).json({ success: false, message: 'Token e nova senha são obrigatórios' });
    }

    // Verificar token válido
    const tokenResult = await db.query(`
      SELECT id FROM usuarios 
      WHERE token_recuperacao = $1 
      AND expiracao_token > CURRENT_TIMESTAMP
    `, [token]);

    if (tokenResult.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Token inválido ou expirado' });
    }

    // Atualizar senha
    const novaSenhaHash = hashSenha(novaSenha);

    await db.query(`
      UPDATE usuarios 
      SET senha_hash = $1, 
          token_recuperacao = NULL, 
          expiracao_token = NULL 
      WHERE token_recuperacao = $2
    `, [novaSenhaHash, token]);

    res.json({ success: true, message: 'Senha redefinida com sucesso' });
  } catch (error) {
    console.error('Erro ao redefinir senha:', error);
    res.status(500).json({ success: false, message: 'Erro interno do servidor' });
  }
});

app.get("/usuario", autenticarToken, async (req, res) => {
  try {
    res.json({
      success: true,
      user: {
        id: req.user.id,
        email: req.user.email,
        nome: req.user.nome,
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erro ao buscar usuário' });
  }
});

app.get("/perguntas-recentes", autenticarToken, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT pergunta, resposta 
      FROM historico_perguntas 
      WHERE id_usuario = $1 
      ORDER BY data_pergunta DESC 
      LIMIT 4
    `, [req.user.id]);

    res.json({
      success: true,
      perguntas: result.rows
    });
  } catch (error) {
    console.error('Erro ao buscar perguntas:', error);
    res.status(500).json({ success: false, message: 'Erro ao buscar perguntas' });
  }
});

app.get("/todas-perguntas", autenticarToken, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT pergunta, resposta, data_pergunta
      FROM historico_perguntas 
      WHERE id_usuario = $1 
      ORDER BY data_pergunta DESC
    `, [req.user.id]);

    res.json({
      success: true,
      perguntas: result.rows
    });
  } catch (error) {
    console.error('Erro ao buscar histórico:', error);
    res.status(500).json({ success: false, message: 'Erro ao buscar histórico' });
  }
});

app.post("/pergunta", async (req, res) => {
  try {
    const { pergunta } = req.body;

    if (!pergunta) {
      return res.status(400).json({ answer: "Pergunta obrigatória" });
    }

    const prompt = `Você é um assistente de respostas rápidas e precisa sempre responder perguntas mesmo que não tenha certeza seja pela quantidade de pessoas ou de possibilidades responda sempre o mais provavel. sempre depois de uma resposta mandar um "Sim" caso respondeu a pergunta e "Não" caso não respondeu. Responda em uma frase de no máximo 5 palavras, de forma direta: ${pergunta}`;

    const result = await model.generateContent(prompt);
    const respostaIA = result.response.text();

    const respostaComSucesso = verificarRespostaComSucesso(respostaIA);

    if (respostaComSucesso) {
      /*if(req.user.id >0){
        await db.query(
            "INSERT INTO historico_perguntas (id_usuario, pergunta, resposta) VALUES ($1, $2, $3)",
            [req.user.id, pergunta, respostaIA]
        );
      }*/

      try {
        await db.query(
            "CALL inserir_deletar_antiga($1, $2)",
            [pergunta, respostaIA]
        );
      } catch (error) {
        console.log("Procedure inserir_deletar_antiga não encontrada, continuando...");
      }

      res.json({
        answer: respostaIA,
        success: true,
        message: "Pergunta respondida e salva no histórico"
      });
    } else {
      res.json({
        answer: respostaIA,
        success: false,
        message: "A IA não conseguiu responder adequadamente à pergunta"
      });
    }
    res.json({ answer: `${pergunta}:${respostaIA}` });

  } catch (error) {
    console.error("Erro detalhado:", error.message);
    res.status(500).json({ answer: "Erro interno ao processar sua pergunta." });
  }
});

app.listen(3000, () => {
  console.log("Servidor rodando na porta 3000");
});

function verificarRespostaComSucesso(resposta) {
  const padraoSim = /\\S|Sim$/i;
  const padraoNao = /\\N|Não$|Nao$/i;
  const respostaLimpa = resposta.trim();

  if (padraoSim.test(respostaLimpa)) {
    return true;
  } else if (padraoNao.test(respostaLimpa)) {
    return false;
  }

  return true;
}