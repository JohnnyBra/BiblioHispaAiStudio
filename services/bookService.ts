
import { getAIRecommendedAge } from './geminiService';

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

const GOOGLE_PLACEHOLDERS = [
    'gbs_preview_button1',
    'no_cover_thumb',
    'printsec=frontcover' // Sometimes returns a generic generated cover we want to avoid if possible
];

export const searchBookCover = async (title: string, author: string): Promise<string | null> => {
  const cleanTitle = cleanSearchText(title);
  const cleanAuthor = cleanSearchText(author);

  const queryStrict = `${cleanTitle} ${cleanAuthor}`;
  const queryLoose = cleanTitle; // Fallback to just title
  
  const encodedQueryStrict = encodeURIComponent(queryStrict);
  const encodedQueryLoose = encodeURIComponent(queryLoose);

  let foundIsbn: string | null = null;

  // Helper function with timeout
  const fetchWithTimeout = async (url: string, timeout = 3000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(id);
      return response;
    } catch (err) {
      clearTimeout(id);
      throw err;
    }
  };

  // --- SOURCE 1: Google Books API (Best for general metadata) ---
  try {
    const res = await fetchWithTimeout(`https://www.googleapis.com/books/v1/volumes?q=${encodedQueryStrict}&maxResults=1&printType=books`);
    if (res.ok) {
      const data = await res.json();
      const item = data.items?.[0];
      const volumeInfo = item?.volumeInfo;
      
      // Capture ISBN for subsequent fallbacks
      if (volumeInfo?.industryIdentifiers) {
        const isbnObj = volumeInfo.industryIdentifiers.find((id: any) => id.type === 'ISBN_13') || 
                        volumeInfo.industryIdentifiers.find((id: any) => id.type === 'ISBN_10');
        if (isbnObj) foundIsbn = isbnObj.identifier;
      }

      const imageLinks = volumeInfo?.imageLinks;
      if (imageLinks) {
        // Try to get the largest available image
        const bestImage = imageLinks.extraLarge || imageLinks.large || imageLinks.medium || imageLinks.thumbnail || imageLinks.smallThumbnail;
        if (bestImage) {
          const url = bestImage.replace('http://', 'https://').replace('&zoom=1', '');
          // Google sometimes returns generic "no cover" images. We try to filter them.
          if (!url.includes('gbs_preview_button') && await validateImageUrl(url)) {
              return url;
          }
        }
      }
    }
  } catch (e) { /* continue */ }

  // --- SOURCE 2: iTunes Search API (Great for high-res covers of popular books) ---
  try {
    const res = await fetchWithTimeout(`https://itunes.apple.com/search?term=${encodedQueryStrict}&media=ebook&entity=ebook&limit=1`);
    if (res.ok) {
      const data = await res.json();
      if (data.results?.[0]?.artworkUrl100) {
        // Hack to get higher resolution from iTunes
        const url = data.results[0].artworkUrl100.replace('100x100', '600x600');
        if (await validateImageUrl(url)) return url;
      }
    }
  } catch (e) { /* continue */ }

  // --- SOURCE 3: Open Library (ISBN Search) ---
  // Highly accurate if Google found an ISBN but no cover
  if (foundIsbn) {
    try {
       const url = `https://covers.openlibrary.org/b/isbn/${foundIsbn}-L.jpg?default=false`;
       // OpenLibrary returns 404 if 'default=false' and no cover exists, or a 1x1 pixel if we don't use that param.
       // We use validateImageUrl to be sure.
       if (await validateImageUrl(url)) return url;
    } catch (e) { /* continue */ }
  }

  // --- SOURCE 4: Open Library (Text Search) ---
  try {
    const res = await fetchWithTimeout(`https://openlibrary.org/search.json?title=${encodeURIComponent(cleanTitle)}&author=${encodeURIComponent(cleanAuthor)}&limit=1`);
    if (res.ok) {
      const data = await res.json();
      const doc = data.docs?.[0];
      if (doc?.cover_i) {
        const url = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
        if (await validateImageUrl(url)) return url;
      }
    }
  } catch (e) { /* continue */ }

  // --- SOURCE 5: Gutendex (Project Gutenberg - Excellent for public domain classics) ---
  try {
    const res = await fetchWithTimeout(`https://gutendex.com/books?search=${encodeURIComponent(cleanTitle)}`);
    if (res.ok) {
      const data = await res.json();
      // Try to match author strictly within results
      const book = data.results?.find((b: any) => 
        b.authors.some((a: any) => cleanAuthor.toLowerCase().includes(a.name.toLowerCase().split(',')[0].trim()))
      ) || data.results?.[0];

      if (book?.formats?.['image/jpeg']) {
        const url = book.formats['image/jpeg'];
        if (await validateImageUrl(url)) return url;
      }
    }
  } catch (e) { /* continue */ }

  // --- SOURCE 6: Google Books (LOOSE SEARCH - Title Only) ---
  // Fallback for when author names are misspelled or "Unknown"
  try {
    const res = await fetchWithTimeout(`https://www.googleapis.com/books/v1/volumes?q=intitle:${encodedQueryLoose}&maxResults=1&printType=books&orderBy=relevance`);
    if (res.ok) {
      const data = await res.json();
      const item = data.items?.[0];
      const imageLinks = item?.volumeInfo?.imageLinks;
      if (imageLinks?.thumbnail) {
        const url = imageLinks.thumbnail.replace('http://', 'https://').replace('&zoom=1', '');
         if (await validateImageUrl(url)) return url;
      }
    }
  } catch (e) { /* continue */ }

  // --- FALLBACK: Return null to let the UI render a CSS generated cover ---
  // We prefer a nice CSS gradient with text over a generic "No Image" placeholder
  return null;
};

export const getBookDetails = async (title: string, author: string): Promise<BookDetails> => {
    const q = encodeURIComponent(`${cleanSearchText(title)} ${cleanSearchText(author)}`);
  
    // 1. Google Books (Restricted to Spanish)
    try {
      const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${q}&langRestrict=es&maxResults=1`);
      if (res.ok) {
        const data = await res.json();
        const info = data.items?.[0]?.volumeInfo;
        if (info && info.description) {
          return {
            description: cleanSynopsisText(info.description),
            pages: info.pageCount,
            publisher: info.publisher,
            publishedDate: info.publishedDate,
            source: 'Google Books'
          };
        }
      }
    } catch (e) { console.error(e); }
  
    // 2. Wikipedia (Spanish) - Good for classics
    try {
      const searchRes = await fetch(`https://es.wikipedia.org/w/api.php?action=query&list=search&srsearch=${q}&format=json&origin=*`);
      const searchData = await searchRes.json();
      
      if (searchData.query?.search?.length > 0) {
        const pageId = searchData.query.search[0].pageid;
        const extractRes = await fetch(`https://es.wikipedia.org/w/api.php?action=query&prop=extracts&exintro&explaintext&pageids=${pageId}&format=json&origin=*`);
        const extractData = await extractRes.json();
        const extract = extractData.query?.pages?.[pageId]?.extract;
  
        if (extract) {
           return {
              description: cleanSynopsisText(extract),
              source: 'Wikipedia'
           };
        }
      }
    } catch (e) { console.error(e); }
  
    return {
      description: "No disponemos de una sinopsis detallada para este libro en este momento. ¡Pero seguro que es fantástico!",
      source: 'Local'
    };
};

export const determineBookAge = async (title: string, author: string): Promise<string> => {
   // Currently defaulting to AI as it's the most reliable for standardizing age ranges
   return await getAIRecommendedAge(title, author);
};
