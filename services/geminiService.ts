
import { GoogleGenAI } from "@google/genai";
import { Book } from "../types";

// Helper to get the AI client only when needed (Lazy Initialization)
const getAIClient = () => {
  // En Vite (producción), las variables están en import.meta.env y deben empezar por VITE_
  // Usamos 'as any' para evitar errores de TypeScript si los tipos de Vite no están cargados globalmente
  let apiKey = (import.meta as any).env?.VITE_API_KEY;

  // Fallback para entornos de prueba o Node.js estándar
  if (!apiKey) {
    apiKey = process.env.API_KEY;
  }
  
  if (!apiKey) {
    console.error("API Key no encontrada. Se buscó VITE_API_KEY en import.meta.env y API_KEY en process.env");
    throw new Error("API Key no encontrada. Asegúrate de tener un archivo .env con VITE_API_KEY=AIza...");
  }
  
  return new GoogleGenAI({ apiKey });
};

export const chatWithLibrarian = async (
  userQuery: string,
  userAgeGroup: string,
  availableBooks: Book[]
): Promise<string> => {
  // Create a simplified catalog for the AI to process efficiently
  const bookList = availableBooks
    .map(b => `- "${b.title}" de ${b.author} (${b.genre}, Estante: ${b.shelf})`)
    .join('\n');

  try {
    const ai = getAIClient();
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
    return "Mi cerebro de robot está desconectado. Dile al profe que revise la API Key en el servidor.";
  }
};

// New function to determine age range automatically
export const getAIRecommendedAge = async (title: string, author: string): Promise<string> => {
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `
        Clasifica el libro "${title}" de "${author}" en UNO de los siguientes rangos de edad exactos.
        
        Rangos permitidos:
        '0-5' (Infantil/Preescolar)
        '6-8' (Primeros lectores)
        '9-11' (Infantil consolidado)
        '12-14' (Juvenil/Adolescente)
        '+15' (Young Adult/Adulto)

        Responde ÚNICAMENTE con el rango (ejemplo: "9-11"). Si no conoces el libro, adivina por el título o devuelve "TP" (Todos los públicos).
      `,
    });
    
    const text = response.text?.trim() || 'TP';
    // Clean up response if AI adds extra text
    const validRanges = ['0-5', '6-8', '9-11', '12-14', '+15'];
    const found = validRanges.find(r => text.includes(r));
    return found || 'TP';

  } catch (error) {
    console.error("Error getting AI age:", error);
    return 'TP';
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
