import { GoogleGenAI, Type } from "@google/genai";

// Restore the original key provided by the user as fallback.
const apiKey = process.env.API_KEY || "gen-lang-client-0108694645";

const ai = new GoogleGenAI({ apiKey });

export const getChefSuggestion = async (userInput: string): Promise<string> => {
  try {
    const model = "gemini-2.5-flash";
    const prompt = `Você é um chef de cozinha assistente e criativo. Responda em Português. Seja breve. O usuário disse: "${userInput}"`;
    
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
    });
    
    return response.text || "Desculpe, não consegui criar uma receita agora.";
  } catch (error) {
    console.error("Erro no Chef IA:", error);
    return "Erro ao conectar com o Chef IA. Verifique sua conexão.";
  }
};

export const fetchNews = async (category: string): Promise<string[]> => {
  const model = "gemini-2.5-flash";
  
  // 1. TENTATIVA COM GOOGLE SEARCH (JSON Schema)
  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: `Liste as 3 manchetes mais recentes, urgentes e importantes sobre ${category} no Brasil.
      Use a ferramenta googleSearch para buscar no 'Google News Brazil' e 'G1' agora mesmo.
      Ignore notícias antigas. Foque no que está acontecendo HOJE.
      Retorne apenas um array JSON de strings com os títulos.`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });

    const jsonText = response.text;
    if (jsonText) {
      const headlines = JSON.parse(jsonText);
      if (Array.isArray(headlines) && headlines.length > 0) {
        return headlines.slice(0, 3);
      }
    }
  } catch (error) {
    console.warn(`Tentativa 1 (Search) falhou para ${category}:`, error);
  }

  // 2. FALLBACK: CONHECIMENTO INTERNO
  try {
    const fallbackResponse = await ai.models.generateContent({
      model: model,
      contents: `Gere 3 manchetes prováveis e realistas sobre ${category} no Brasil baseadas nos tópicos mais quentes da semana.
      Seja factual. Retorne um array JSON de strings.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });

    const fallbackJson = fallbackResponse.text;
    if (fallbackJson) {
      const headlines = JSON.parse(fallbackJson);
      if (Array.isArray(headlines) && headlines.length > 0) {
        return headlines.map(h => `${h} (Destaque)`); 
      }
    }
  } catch (error2) {
    console.error(`Tentativa 2 (Internal) falhou para ${category}:`, error2);
  }

  return [
    `Não foi possível carregar ${category}.`,
    "Verifique sua conexão com a internet.",
    "Tentando atualizar novamente..."
  ];
};

export const generateNewsReport = async (headline: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `O usuário quer ouvir sobre esta notícia ou tópico: "${headline}".
      Use a ferramenta googleSearch para buscar informações atualizadas sobre isso AGORA.
      Atue como um âncora de jornal. Escreva um resumo completo, informativo e profissional de 3 parágrafos sobre esse tópico, como se estivesse lendo a notícia no rádio.
      Seja direto e informativo.`,
      config: {
        tools: [{ googleSearch: {} }],
      }
    });
    return response.text || "Não consegui carregar os detalhes desta notícia.";
  } catch (error) {
    console.error("News report generation failed", error);
    return "Erro ao gerar o relatório da notícia. Tente novamente.";
  }
};

export interface VoiceCommandResult {
  action: "add_reminder" | "chat" | "read_news_init";
  text?: string;
  type?: "info" | "alert" | "action";
  response?: string;
}

export const processVoiceCommandAI = async (text: string): Promise<VoiceCommandResult | null> => {
  try {
    const model = "gemini-2.5-flash";
    const systemInstruction = `
      Você é o "Smart Home". Analise o comando do usuário.
      1. Se o usuário disser apenas "ler notícias", "notícias", "o que está acontecendo", retorne action="read_news_init" e response="Qual notícia você quer que eu leia?".
      2. Se o usuário disser "ler notícias sobre [TÓPICO]" ou "notícias de [TÓPICO]", retorne action="read_news_init", text="[TÓPICO]" e response="Buscando notícias sobre [TÓPICO]...".
      3. Se for para adicionar um lembrete, tarefa ou compromisso, retorne action="add_reminder".
      4. Se for uma pergunta geral ou conversa, retorne action="chat".
      Classifique lembretes em: 'info', 'alert' (urgente) ou 'action' (tarefa).
      Responda APENAS JSON.
    `;

    const response = await ai.models.generateContent({
      model: model,
      contents: text,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            action: { type: Type.STRING, enum: ["add_reminder", "chat", "read_news_init"] },
            text: { type: Type.STRING, description: "O texto do lembrete ou tópico da notícia" },
            type: { type: Type.STRING, enum: ["info", "alert", "action"], description: "Tipo do lembrete" },
            response: { type: Type.STRING, description: "Resposta falada para o usuário" }
          },
          required: ["action", "response"]
        }
      }
    });

    const jsonStr = response.text;
    if (!jsonStr) return null;
    return JSON.parse(jsonStr) as VoiceCommandResult;
  } catch (error) {
    console.error("Erro no comando de voz IA:", error);
    return null;
  }
};