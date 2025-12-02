
import { GoogleGenAI } from "@google/genai";
import { Book } from "../types";

// Safety check for API Key presence to prevent crashes
const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const chatWithLibrarian = async (
  userQuery: string,
  userAgeGroup: string,
  availableBooks: Book[]
): Promise<string> => {
  if (!apiKey) return "La BiblioIA está durmiendo (Falta API Key).";

  // Create a simplified catalog for the AI to process efficiently
  const bookList = availableBooks
    .map(b => `- "${b.title}" de ${b.author} (${b.genre}, Estante: ${b.shelf})`)
    .join('\n');

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `
        Actúa como "BiblioBot", un bibliotecario escolar súper divertido, amable y experto en literatura infantil y juvenil.
        
        Tu misión es ayudar a un alumno de ${userAgeGroup} años.
        
        CATÁLOGO DE LA BIBLIOTECA (Solo recomienda libros de esta lista):
        ${bookList}

        PREGUNTA DEL ALUMNO:
        "${userQuery}"

        INSTRUCCIONES:
        1. Responde de forma breve (máximo 3 frases).
        2. Si la pregunta es sobre recomendación, sugiere 1 o 2 libros DEL CATÁLOGO que encajen mejor.
        3. Si el alumno pregunta algo general ("hola", "quién eres"), preséntate divertidamente.
        4. Usa emojis para hacerlo visual.
        5. Si no hay libros que encajen perfectamente, recomiéndale el que más se acerque o invítale a explorar el estante de "Aventuras".
      `,
    });
    return response.text || "¡Ups! Se me ha caído un libro y no te he escuchado. ¿Repites?";
  } catch (error) {
    console.error("Error calling Gemini:", error);
    return "Mi cerebro de robot está echando humo. Inténtalo en un ratito.";
  }
};

// Legacy support if needed, redirects to chat
export const getBookRecommendation = async (
  userAgeGroup: string,
  userInterests: string,
  availableBooks: Book[]
): Promise<string> => {
  return chatWithLibrarian(`Me interesan cosas como: ${userInterests}. ¿Qué me recomiendas?`, userAgeGroup, availableBooks);
};
