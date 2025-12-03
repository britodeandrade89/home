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
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Liste as 3 manchetes mais recentes e importantes sobre ${category} no Brasil.
      Use a ferramenta de busca do Google para encontrar informações atualizadas de hoje no Google News.
      Retorne APENAS os títulos das notícias, separados por "|||". 
      Não use numeração, bullets ou markdown. Apenas texto puro separado por |||.`,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });

    const text = response.text;
    if (!text) return [];
    
    // Split by separator and clean up
    return text.split('|||').map(t => t.trim()).filter(t => t.length > 5).slice(0, 3);
  } catch (error) {
    console.error(`Erro ao buscar notícias de ${category}:`, error);
    // Return empty array to let UI handle it or show skeletons
    return [];
  }
};

export interface VoiceCommandResult {
  action: "add_reminder" | "chat";
  text?: string;
  type?: "info" | "alert" | "action";
  response?: string;
}

export const processVoiceCommandAI = async (text: string): Promise<VoiceCommandResult | null> => {
  try {
    const model = "gemini-2.5-flash";
    const systemInstruction = `
      Você é o "Smart Home". Analise o comando do usuário.
      Se for para adicionar um lembrete, tarefa ou compromisso, retorne action="add_reminder".
      Se for uma pergunta geral ou conversa, retorne action="chat".
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
            action: { type: Type.STRING, enum: ["add_reminder", "chat"] },
            text: { type: Type.STRING, description: "O texto do lembrete, se aplicável" },
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