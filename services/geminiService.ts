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
        Clasifica el libro "${title}" de "${author}" en UNO de los siguientes rangos de edad recomendada.
        
        Rangos permitidos (y sus significados):
        '0-5'  (Infantil / Preescolar / 0 a 5 años)
        '6-8'  (Primeros lectores / 6 a 8 años)
        '9-11' (Infantil consolidado / 9 a 11 años)
        '12-14' (Juvenil / Adolescente / 12 a 14 años)
        '+15'  (Young Adult / Adulto / 15 años o más)

        Instrucciones:
        - Responde ÚNICAMENTE con el rango exacto (ej: "9-11").
        - No añadas texto adicional.
        - Si el libro tiene un rango amplio, elige el más representativo basándote en la complejidad del texto y la temática.
        - Si no conoces el libro, intenta deducirlo por el título y autor.
        - JAMÁS respondas "TP". Debes elegir uno de los rangos numéricos obligatoriamente.
        - Si dudas, elige '6-8' o '9-11' según parezca más infantil o juvenil.
      `,
    });
    
    const text = response.text?.trim() || '6-8';
    const validRanges = ['0-5', '6-8', '9-11', '12-14', '+15'];
    // Check for exact match or substring match if the AI is chatty
    const found = validRanges.find(r => text.includes(r));
    return found || '6-8';

  } catch (error) {
    console.error("Error getting AI age:", error);
    return '6-8';
  }
};

export const getBookRecommendation = async (
  userAgeGroup: string,
  userInterests: string,
  availableBooks: Book[]
): Promise<string> => {
  return chatWithLibrarian(`Me interesan cosas como: ${userInterests}. ¿Qué me recomiendas?`, userAgeGroup, availableBooks);
};

// --- BATCH: Identify multiple books + age in a single Gemini call ---
export interface BatchBookResult {
  title: string;
  author: string;
  isbn: string;
  recommendedAge: string;
}

export const identifyBooksBatch = async (
  books: { title: string; author: string }[]
): Promise<BatchBookResult[]> => {
  if (books.length === 0) return [];

  const CHUNK_SIZE = 30;
  const results: BatchBookResult[] = [];

  for (let i = 0; i < books.length; i += CHUNK_SIZE) {
    const chunk = books.slice(i, i + CHUNK_SIZE);
    const bookList = chunk.map((b, idx) => `${idx + 1}. "${b.title}" de "${b.author}"`).join('\n');

    try {
      const ai = getAIClient();
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `
          Para cada libro de la siguiente lista, proporciona:
          - El título exacto (original o el más conocido en español)
          - El autor correcto
          - El ISBN-13 (13 dígitos). Si no lo conoces con certeza, pon ""
          - La edad recomendada: uno de estos rangos exactos: "0-5", "6-8", "9-11", "12-14", "+15"

          Lista de libros:
          ${bookList}

          Responde ÚNICAMENTE con un JSON array válido (sin markdown, sin backticks), ejemplo:
          [{"title":"...","author":"...","isbn":"...","recommendedAge":"6-8"},...]

          IMPORTANTE:
          - El array debe tener exactamente ${chunk.length} elementos, uno por cada libro, en el mismo orden.
          - Si no puedes identificar un libro, devuelve el título y autor tal cual, isbn "" y recommendedAge "6-8".
          - No añadas texto fuera del JSON.
        `,
      });

      const text = response.text?.trim() || '[]';
      const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      const parsed = JSON.parse(cleaned);

      if (Array.isArray(parsed)) {
        const validRanges = ['0-5', '6-8', '9-11', '12-14', '+15'];
        for (let j = 0; j < chunk.length; j++) {
          const item = parsed[j];
          if (item && item.title) {
            const age = validRanges.find(r => (item.recommendedAge || '').includes(r)) || '6-8';
            results.push({ title: item.title, author: item.author || chunk[j].author, isbn: item.isbn || '', recommendedAge: age });
          } else {
            results.push({ title: chunk[j].title, author: chunk[j].author, isbn: '', recommendedAge: '6-8' });
          }
        }
      } else {
        // Fallback: use original data
        chunk.forEach(b => results.push({ title: b.title, author: b.author, isbn: '', recommendedAge: '6-8' }));
      }
    } catch (error) {
      console.error("Error in batch identify:", error);
      chunk.forEach(b => results.push({ title: b.title, author: b.author, isbn: '', recommendedAge: '6-8' }));
    }
  }

  return results;
};

export const identifyBook = async (query: string): Promise<{title: string, author: string, isbn: string} | null> => {
  try {
    const ai = getAIClient();

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `
        Identifica el libro exacto a partir de esta búsqueda: "${query}"

        Responde ÚNICAMENTE con un JSON válido (sin markdown, sin backticks) con este formato:
        {"title": "Título exacto del libro", "author": "Nombre del autor", "isbn": "ISBN-13 de 13 dígitos"}

        Instrucciones:
        - El título debe ser el título original o el más conocido en español si existe traducción.
        - El ISBN debe ser el ISBN-13. Si no lo conoces con certeza, pon "".
        - Si no puedes identificar el libro, responde exactamente: null
      `,
    });

    const text = response.text?.trim() || '';
    if (!text || text === 'null') return null;

    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(cleaned);

    if (parsed && parsed.title) {
      return {
        title: parsed.title,
        author: parsed.author || '',
        isbn: parsed.isbn || ''
      };
    }
    return null;
  } catch (error) {
    console.error("Error identifying book with Gemini:", error);
    return null;
  }
};
