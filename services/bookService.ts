
import { getAIRecommendedAge, identifyBook, identifyBooksBatch } from './geminiService';
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

// --- LIBRARIO COVER SEARCH (stub — requires API key) ---
// Endpoint: GET https://api.librario.dev/v1/book/{isbn}/cover
// Auth: Authorization: Bearer librario_xxx
// Activate when VITE_LIBRARIO_API_KEY is set in .env
const searchLibrarioCover = async (isbn?: string): Promise<string | null> => {
    if (!isbn) return null;
    const apiKey = (import.meta as any).env?.VITE_LIBRARIO_API_KEY;
    if (!apiKey) return null;
    try {
        const res = await fetch(`https://api.librario.dev/v1/book/${isbn}/cover`, {
            method: 'HEAD',
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        if (res.ok) return `https://api.librario.dev/v1/book/${isbn}/cover`;
    } catch { /* Librario not available */ }
    return null;
};

// --- OPEN LIBRARY COVER SEARCH ---
const searchOpenLibraryCover = async (isbn?: string, title?: string): Promise<string | null> => {
    // Try ISBN first (most precise)
    if (isbn) {
        const url = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`;
        try {
            const res = await fetch(url, { method: 'HEAD' });
            if (res.ok) return `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;
        } catch { /* ignore */ }
    }

    // Fallback: search by text
    if (title) {
        try {
            const q = encodeURIComponent(cleanSearchText(title));
            const res = await fetch(`https://openlibrary.org/search.json?q=${q}&fields=cover_i,isbn&limit=1`);
            if (res.ok) {
                const data = await res.json();
                if (data.docs?.[0]?.cover_i) {
                    return `https://covers.openlibrary.org/b/id/${data.docs[0].cover_i}-L.jpg`;
                }
            }
        } catch { /* ignore */ }
    }

    return null;
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

// Parse a Google Books API response into candidate Book partials
const parseGoogleBooksItems = (items: any[], fallbackTitle: string): Partial<Book>[] => {
    return items.map((item: any) => {
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
            title: info.title || fallbackTitle,
            author: info.authors ? info.authors.join(', ') : 'Desconocido',
            description: cleanSynopsisText(info.description),
            coverUrl: coverUrl,
            genre: genre,
            pageCount: info.pageCount,
            publisher: info.publisher,
            publishedDate: info.publishedDate,
            isbn: isbn,
            recommendedAge: '6-8' // Will be augmented by AI later if selected
        };
    });
};

// Fetch candidates from Google Books API
const fetchGoogleBooks = async (query: string, maxResults = 10): Promise<Partial<Book>[]> => {
    try {
        const encoded = encodeURIComponent(query);
        const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encoded}&maxResults=${maxResults}&printType=books`);
        if (res.ok) {
            const data = await res.json();
            if (data.items) return parseGoogleBooksItems(data.items, query);
        }
    } catch (e) {
        console.error("Error fetching Google Books:", e);
    }
    return [];
};

export const searchBookCandidates = async (query: string): Promise<Partial<Book>[]> => {
    const cleanQuery = cleanSearchText(query);

    // Step 1: Run Gemini identification and Google Books search in parallel
    const [geminiResult, googleCandidates] = await Promise.all([
        identifyBook(query).catch(() => null),
        fetchGoogleBooks(cleanQuery)
    ]);

    let candidates = [...googleCandidates];

    // Step 2: If Gemini returned an ISBN, do a precise Google Books search
    if (geminiResult?.isbn) {
        const isbnCandidates = await fetchGoogleBooks(`isbn:${geminiResult.isbn}`, 1);
        if (isbnCandidates.length > 0) {
            const precise = isbnCandidates[0];
            // Insert at front if not already present (by ISBN or title match)
            const isDuplicate = candidates.some(c =>
                (c.isbn && c.isbn === precise.isbn) ||
                (c.title?.toLowerCase() === precise.title?.toLowerCase())
            );
            if (!isDuplicate) {
                candidates.unshift(precise);
            }
        }
    } else if (geminiResult?.title) {
        // Gemini identified the book but no ISBN — try a more precise Google search
        const preciseQuery = `${geminiResult.title} ${geminiResult.author}`.trim();
        if (preciseQuery.toLowerCase() !== cleanQuery.toLowerCase()) {
            const preciseCandidates = await fetchGoogleBooks(preciseQuery, 3);
            if (preciseCandidates.length > 0) {
                const precise = preciseCandidates[0];
                const isDuplicate = candidates.some(c =>
                    c.title?.toLowerCase() === precise.title?.toLowerCase()
                );
                if (!isDuplicate) {
                    candidates.unshift(precise);
                }
            }
        }
    }

    // Step 3: Upgrade covers — priority: Librario > Open Library > Google Books
    // For each candidate, try higher-quality sources and replace Google Books cover if found
    await Promise.all(candidates.map(async (candidate) => {
        const googleCover = candidate.coverUrl; // Save original Google Books cover as fallback

        // Try Librario first (requires API key — stub until configured)
        if (candidate.isbn) {
            const librarioCover = await searchLibrarioCover(candidate.isbn);
            if (librarioCover) { candidate.coverUrl = librarioCover; return; }
        }

        // Try Open Library (by ISBN first, then by text)
        const olCover = await searchOpenLibraryCover(candidate.isbn, candidate.title);
        if (olCover) { candidate.coverUrl = olCover; return; }

        // Keep Google Books cover as last resort (already set if available)
        if (!candidate.coverUrl) candidate.coverUrl = googleCover;
    }));

    return candidates;
}

// Kept for backward compatibility and simple usage (returns top result)
export const searchBookMetadata = async (query: string): Promise<Partial<Book>> => {
    const candidates = await searchBookCandidates(query);
    const bestMatch = candidates[0] || {
        title: query,
        author: 'Desconocido',
        genre: 'General',
        recommendedAge: '6-8'
    };

    // ALWAYS try to get AI age recommendation, even if we didn't find the book in Google Books
    // (using the query as title if needed)
    try {
        const titleForAI = bestMatch.title || query;
        const authorForAI = bestMatch.author || '';
        const age = await getAIRecommendedAge(titleForAI, authorForAI);
        bestMatch.recommendedAge = age;
    } catch (e) {
        console.error("Failed to get AI age in metadata search", e);
    }

    return bestMatch;
};


// --- BATCH METADATA (minimizes Gemini calls) ---
// One Gemini call identifies all books + ages, then covers fetched via Google Books/Open Library
export const searchBookMetadataBatch = async (
    books: { title: string; author: string }[],
    onProgress?: (current: number, total: number, title: string) => void
): Promise<Partial<Book>[]> => {
    if (books.length === 0) return [];

    // Step 1: Single Gemini call for all books (ISBN + age)
    onProgress?.(0, books.length, 'Identificando libros con IA...');
    const geminiResults = await identifyBooksBatch(books);

    // Step 2: For each book, fetch cover + metadata from Google Books / Open Library
    const results: Partial<Book>[] = [];
    for (let i = 0; i < books.length; i++) {
        const original = books[i];
        const gemini = geminiResults[i];
        onProgress?.(i + 1, books.length, original.title);

        let coverUrl: string | undefined;
        let description: string | undefined;
        let genre = 'General';
        let pageCount: number | undefined;
        let publisher: string | undefined;
        let publishedDate: string | undefined;
        const isbn = gemini?.isbn || undefined;

        // Try Google Books for full metadata (no Gemini call, just HTTP)
        try {
            const query = isbn ? `isbn:${isbn}` : `${original.title} ${original.author}`;
            const googleResults = await fetchGoogleBooks(query, 1);
            if (googleResults.length > 0) {
                const gb = googleResults[0];
                coverUrl = gb.coverUrl;
                description = gb.description;
                genre = gb.genre || genre;
                pageCount = gb.pageCount;
                publisher = gb.publisher;
                publishedDate = gb.publishedDate;
            }
        } catch { /* ignore */ }

        // Upgrade cover: Librario > Open Library > Google Books
        const googleCover = coverUrl;
        if (isbn) {
            const librarioCover = await searchLibrarioCover(isbn);
            if (librarioCover) { coverUrl = librarioCover; }
            else {
                const olCover = await searchOpenLibraryCover(isbn, original.title);
                if (olCover) coverUrl = olCover;
            }
        } else if (!coverUrl) {
            const olCover = await searchOpenLibraryCover(undefined, original.title);
            if (olCover) coverUrl = olCover;
        }
        if (!coverUrl) coverUrl = googleCover;

        results.push({
            title: original.title,
            author: gemini?.author || original.author || 'Desconocido',
            genre,
            coverUrl,
            description,
            isbn,
            pageCount,
            publisher,
            publishedDate,
            recommendedAge: gemini?.recommendedAge || '6-8'
        });
    }

    return results;
};

// --- CRUD operations ---

const API_URL = '/api/books';

export const addBook = async (book: Partial<Book>): Promise<Book> => {
    const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(book)
    });
    if (!res.ok) throw new Error('Failed to add book');
    return res.json();
};

export const updateBook = async (book: Book): Promise<Book> => {
    const res = await fetch(`${API_URL}/${book.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(book)
    });
    if (!res.ok) throw new Error('Failed to update book');
    return res.json();
};

export const deleteBook = async (id: string): Promise<void> => {
    const res = await fetch(`${API_URL}/${id}`, {
        method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete book');
};

export const importBooks = async (books: Partial<Book>[]): Promise<Book[]> => {
    const res = await fetch(`${API_URL}/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(books)
    });
    if (!res.ok) throw new Error('Failed to import books');
    return res.json();
};
