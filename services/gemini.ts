
import { GoogleGenAI, Type, Chat } from "@google/genai";

// Inicialização segura
const getAiClient = () => {
  let key = "";
  try {
    if (typeof process !== "undefined" && process.env && process.env.API_KEY) {
      key = process.env.API_KEY;
    }
  } catch (e) {
    console.warn("Ambiente sem process.env");
  }
  return new GoogleGenAI({ apiKey: key });
};

// --- CHAT FEATURE ---
let chatSession: Chat | null = null;

export const getChatResponse = async (userMessage: string): Promise<string> => {
  try {
    if (!chatSession) {
      chatSession = getAiClient().chats.create({
        model: "gemini-3-flash-preview",
        config: {
          systemInstruction: `Você é o "Smart Home Assistant", uma IA de painel doméstico em Maricá-RJ. Seja direto e amigável.`,
        },
      });
    }
    const result = await chatSession.sendMessage({ message: userMessage });
    return result.text || "Sem resposta.";
  } catch (error) {
    console.error("Erro no Chat IA:", error);
    return "Erro de conexão.";
  }
};

// DADOS DE SEGURANÇA (FALLBACK) - Garantem que sempre haja algo na tela
export const BEACH_FALLBACK = [
  { name: "Ponta Negra", condition: "Boa", water: "23°C", waves: "0.5m", recommendation: "Melhor Opção" },
  { name: "Barra de Maricá", condition: "Regular", water: "21°C", waves: "1.2m", recommendation: "Atenção" },
  { name: "Itaipuaçu", condition: "Perigosa", water: "20°C", waves: "2.0m", recommendation: "Evite Banho" },
  { name: "Cordeirinho", condition: "Agitada", water: "22°C", waves: "1.5m", recommendation: "Cuidado" }
];

export const generateBeachReport = async (weatherData: any, locationName: string): Promise<any[]> => {
  try {
    const prompt = `
      Atue como um salva-vidas em Maricá-RJ.
      Clima atual: ${weatherData.temperature}°C, Vento ${weatherData.wind_speed}km/h.
      
      Gere um JSON array para: Ponta Negra, Barra de Maricá, Itaipuaçu, Cordeirinho.
      
      Estrutura exata:
      [
        { 
          "name": "Nome da Praia", 
          "condition": "Boa" | "Regular" | "Perigosa", 
          "water": "XX°C", 
          "waves": "X.Xm",
          "recommendation": "Melhor Opção" | "Cuidado" | "Evite Banho" (Escolha APENAS UMA praia como "Melhor Opção")
        }
      ]
    `;

    const response = await getAiClient().models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
               name: { type: Type.STRING },
               condition: { type: Type.STRING },
               water: { type: Type.STRING },
               waves: { type: Type.STRING },
               recommendation: { type: Type.STRING }
            }
          }
        },
      }
    });
    
    const text = response.text;
    if (!text) return BEACH_FALLBACK;
    const data = JSON.parse(text);
    return data.length > 0 ? data : BEACH_FALLBACK;
  } catch (e) {
    console.error("Beach report failed, using fallback", e);
    return BEACH_FALLBACK;
  }
};

export const getChefSuggestion = async (ingredients: string): Promise<string> => {
  try {
    const response = await getAiClient().models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Sugira uma receita criativa com estes ingredientes: ${ingredients}. Seja sucinto e use markdown.`,
      config: {
        systemInstruction: "Você é um Chef IA especializado em culinária caseira rápida.",
      },
    });
    return response.text || "Não consegui criar uma receita agora.";
  } catch (error) {
    console.error("Chef IA error:", error);
    return "Erro ao contatar o Chef.";
  }
};

export const generateNewsReport = async (): Promise<any> => {
  try {
    const response = await getAiClient().models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "Gere 3 manchetes fictícias curtas para Maricá-RJ (Política, Esportes e Cultura).",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            politica: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  text: { type: Type.STRING },
                  time: { type: Type.STRING },
                  img: { type: Type.STRING }
                }
              }
            },
            esportes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  text: { type: Type.STRING },
                  time: { type: Type.STRING },
                  img: { type: Type.STRING }
                }
              }
            },
            cultura: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  text: { type: Type.STRING },
                  time: { type: Type.STRING },
                  img: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    });
    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("News report failed", error);
    return { politica: [], esportes: [], cultura: [] };
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
    const response = await getAiClient().models.generateContent({
      model: "gemini-3-flash-preview",
      contents: text,
      config: {
        systemInstruction: `Analise comandos Smart Home. APENAS JSON.`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            action: { type: Type.STRING, enum: ["add_reminder", "chat", "read_news_init"] },
            text: { type: Type.STRING },
            type: { type: Type.STRING, enum: ["info", "alert", "action"] },
            response: { type: Type.STRING }
          },
          required: ["action", "response"]
        }
      }
    });
    const jsonStr = response.text;
    return jsonStr ? JSON.parse(jsonStr) : null;
  } catch (error) {
    return null;
  }
};
