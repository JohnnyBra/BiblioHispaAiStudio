import { GoogleGenAI } from "@google/genai";
import { Book } from "../types";

// Helper to initialize AI only when needed (Lazy Load)
const getAIClient = () => {
  // The API key must be obtained exclusively from the environment variable process.env.API_KEY.
  // Assume this variable is pre-configured, valid, and accessible.
  const apiKey = process.env.API_KEY;
  
  if (!apiKey) {
    console.error("API Key not found. Please check your .env file and ensure API_KEY is set.");
    throw new Error("API Key missing");
  }
  
  return new GoogleGenAI({ apiKey });
};

export const chatWithLibrarian = async (
  userQuery: string,
  userAgeGroup: string,
  availableBooks: Book[]
): Promise<string> => {
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
    return "No puedo conectar con mi cerebro robot. Por favor, avisa al profesor para revisar la conexión.";
  }
};

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
    const validRanges = ['0-5', '6-8', '9-11', '12-14', '+15'];
    const found = validRanges.find(r => text.includes(r));
    return found || 'TP';

  } catch (error) {
    console.error("Error getting AI age:", error);
    return 'TP';
  }
};

export const getBookRecommendation = async (
  userAgeGroup: string,
  userInterests: string,
  availableBooks: Book[]
): Promise<string> => {
  return chatWithLibrarian(`Me interesan cosas como: ${userInterests}. ¿Qué me recomiendas?`, userAgeGroup, availableBooks);
};
