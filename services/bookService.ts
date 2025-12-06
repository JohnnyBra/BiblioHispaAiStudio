
import { getAIRecommendedAge } from './geminiService';
import { Book } from '../types';

export interface BookDetails {
  description: string;
  pages?: number;
  publisher?: string;
  publishedDate?: string;
  source: string;
}

// Helper para limpiar texto, usado en múltiples funciones
const cleanSearchText = (text: string) => text
    .replace(/\([^)]*\)|\[[^\]]*\]/g, '') // Remove (...) and [...]
    .replace(/\b(vol|volumen|edicion|edition|tomo|libro|parte|book|volume)\b.*/iy, '') // Remove volume info
    .replace(/\b(tapa|blanda|dura|bolsillo|paperback|hardcover)\b.*/iy, '') // Remove binding info
    .replace(/[-:]\s*$/, '') // Remove trailing separators
    .trim();

// Nueva función robusta para limpiar la sinopsis y arreglar codificación
const cleanSynopsisText = (text: string): string => {
    if (!text) return "";
    
    // 1. Decodificar entidades HTML básicas
    let decoded = text
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&aacute;/g, 'á')
        .replace(/&eacute;/g, 'é')
        .replace(/&iacute;/g, 'í')
        .replace(/&oacute;/g, 'ó')
        .replace(/&uacute;/g, 'ú')
        .replace(/&ntilde;/g, 'ñ')
        .replace(/&Aacute;/g, 'Á')
        .replace(/&Eacute;/g, 'É')
        .replace(/&Iacute;/g, 'Í')
        .replace(/&Oacute;/g, 'Ó')
        .replace(/&Uacute;/g, 'Ú')
        .replace(/&Ntilde;/g, 'Ñ');

    // 2. Corregir errores comunes de UTF-8 interpretado como ISO-8859-1 (Mojibake)
    decoded = decoded
        .replace(/Ã¡/g, 'á')
        .replace(/Ã©/g, 'é')
        .replace(/Ã­/g, 'í')
        .replace(/Ã³/g, 'ó')
        .replace(/Ãº/g, 'ú')
        .replace(/Ã±/g, 'ñ')
        .replace(/Ã/g, 'Á')
        .replace(/Ã‰/g, 'É')
        .replace(/Ã/g, 'Í')
        .replace(/Ã“/g, 'Ó')
        .replace(/Ãš/g, 'Ú')
        .replace(/Ã‘/g, 'Ñ')
        .replace(/â€œ/g, '"')
        .replace(/â€/g, '"')
        .replace(/â€™/g, "'");

    // 3. Limpiar tags HTML residuales
    decoded = decoded.replace(/<[^>]*>?/gm, '');

    return decoded;
};

// --- IMAGE VALIDATION ---
// Preloads image to check if it exists and is not a 1x1 pixel or broken link
const validateImageUrl = (url: string): Promise<boolean> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            // Check width to avoid tracking pixels or small placeholder icons
            if (img.naturalWidth > 50) {
                resolve(true);
            } else {
                resolve(false);
            }
        };
        img.onerror = () => resolve(false);
        img.src = url;
    });
};

export const searchBookCover = async (title: string, author: string): Promise<string | null> => {
    const meta = await searchBookMetadata(title);
    return meta.coverUrl || null;
};

export const getBookDetails = async (title: string, author: string): Promise<BookDetails> => {
    const meta = await searchBookMetadata(title);
    if (meta.description) {
        return {
            description: meta.description,
            pages: meta.pageCount,
            publisher: meta.publisher,
            publishedDate: meta.publishedDate,
            source: 'Internet'
        };
    }
    return {
      description: "No disponemos de una sinopsis detallada para este libro en este momento. ¡Pero seguro que es fantástico!",
      source: 'Local'
    };
};

export const determineBookAge = async (title: string, author: string): Promise<string> => {
   // Currently defaulting to AI as it's the most reliable for standardizing age ranges
   return await getAIRecommendedAge(title, author);
};

export const searchBookCandidates = async (query: string): Promise<Partial<Book>[]> => {
    const cleanQuery = cleanSearchText(query);
    const encodedQuery = encodeURIComponent(cleanQuery);

    try {
        // Fetch up to 10 candidates
        const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodedQuery}&maxResults=10&printType=books`);
        if (res.ok) {
            const data = await res.json();
            if (!data.items) return [];

            return data.items.map((item: any) => {
                const info = item.volumeInfo;

                // Extract best image
                let coverUrl: string | undefined = undefined;
                if (info.imageLinks) {
                     const bestImage = info.imageLinks.extraLarge || info.imageLinks.large || info.imageLinks.medium || info.imageLinks.thumbnail || info.imageLinks.smallThumbnail;
                     if (bestImage) {
                         const url = bestImage.replace('http://', 'https://').replace('&zoom=1', '');
                         if (!url.includes('gbs_preview_button')) {
                             coverUrl = url;
                         }
                     }
                }

                // Extract ISBN
                let isbn = undefined;
                if (info.industryIdentifiers) {
                    const isbnObj = info.industryIdentifiers.find((id: any) => id.type === 'ISBN_13') ||
                                    info.industryIdentifiers.find((id: any) => id.type === 'ISBN_10');
                    if (isbnObj) isbn = isbnObj.identifier;
                }

                // Map Genre (Categories)
                let genre = 'General';
                if (info.categories && info.categories.length > 0) {
                    const cat = info.categories[0].toLowerCase();
                    if (cat.includes('fiction') || cat.includes('ficción')) genre = 'Ficción';
                    else if (cat.includes('fantasy') || cat.includes('fantasía')) genre = 'Fantasía';
                    else if (cat.includes('adventure') || cat.includes('aventura')) genre = 'Aventuras';
                    else if (cat.includes('science') || cat.includes('ciencia')) genre = 'Ciencia';
                    else if (cat.includes('biography') || cat.includes('biografía')) genre = 'Biografía';
                    else if (cat.includes('history') || cat.includes('historia')) genre = 'Historia';
                    else if (cat.includes('horror') || cat.includes('miedo')) genre = 'Miedo';
                    else genre = info.categories[0];
                }

                return {
                    title: info.title || query,
                    author: info.authors ? info.authors.join(', ') : 'Desconocido',
                    description: cleanSynopsisText(info.description),
                    coverUrl: coverUrl,
                    genre: genre,
                    pageCount: info.pageCount,
                    publisher: info.publisher,
                    publishedDate: info.publishedDate,
                    isbn: isbn,
                    recommendedAge: 'TP' // Will be augmented by AI later if selected
                };
            });
        }
    } catch (e) {
        console.error("Error searching Google Books:", e);
    }
    return [];
}

// Kept for backward compatibility and simple usage (returns top result)
export const searchBookMetadata = async (query: string): Promise<Partial<Book>> => {
    const candidates = await searchBookCandidates(query);
    const bestMatch = candidates[0] || {
        title: query,
        author: 'Desconocido',
        genre: 'General',
        recommendedAge: 'TP'
    };

    // Augment with AI Age if valid match
    if (candidates.length > 0) {
        try {
            const age = await getAIRecommendedAge(bestMatch.title || query, bestMatch.author || '');
            bestMatch.recommendedAge = age;
        } catch (e) { /* ignore */ }
    }

    return bestMatch;
};
