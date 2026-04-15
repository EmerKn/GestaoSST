import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function test() {
  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-preview',
    contents: "Busque informações sobre o CA 36253 no site consultaca.com. Retorne Nome do EPI, Nome Comercial, Descrição Completa, Dados Complementares e URL da foto.",
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          nome: { type: Type.STRING },
          nome_comercial: { type: Type.STRING },
          descricao: { type: Type.STRING },
          dados_complementares: { type: Type.STRING },
          foto_url: { type: Type.STRING }
        }
      }
    }
  });
  console.log(response.text);
}

test();
