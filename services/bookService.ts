
export const searchBookCover = async (title: string, author: string): Promise<string> => {
  // 0. CLEANING: Remove common noise from titles (e.g., "(Edición 2024)", "vol. 1") to improve match rate
  const cleanText = (text: string) => text.replace(/\([^)]*\)|\[[^\]]*\]/g, '').replace(/\b(vol|volumen|edicion|edition|tomo)\b.*/iy, '').trim();
  
  const cleanTitle = cleanText(title);
  const cleanAuthor = cleanText(author);

  const queryStrict = `${cleanTitle} ${cleanAuthor}`;
  const queryLoose = cleanTitle; // Fallback to just title
  
  const encodedQueryStrict = encodeURIComponent(queryStrict);
  const encodedQueryLoose = encodeURIComponent(queryLoose);

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
      const imageLinks = item?.volumeInfo?.imageLinks;
      
      if (imageLinks) {
        const bestImage = imageLinks.extraLarge || imageLinks.large || imageLinks.medium || imageLinks.thumbnail;
        if (bestImage) {
          return bestImage.replace('http://', 'https://').replace('&zoom=1', '');
        }
      }
    }
  } catch (e) { /* continue */ }

  // --- SOURCE 2: iTunes Search API (Great for modern popular books) ---
  try {
    const res = await fetchWithTimeout(`https://itunes.apple.com/search?term=${encodedQueryStrict}&media=ebook&entity=ebook&limit=1`);
    if (res.ok) {
      const data = await res.json();
      if (data.results?.[0]?.artworkUrl100) {
        return data.results[0].artworkUrl100.replace('100x100', '600x600');
      }
    }
  } catch (e) { /* continue */ }

  // --- SOURCE 3: Open Library (Great for classics) ---
  try {
    const res = await fetchWithTimeout(`https://openlibrary.org/search.json?q=${encodedQueryStrict}&limit=1`);
    if (res.ok) {
      const data = await res.json();
      const doc = data.docs?.[0];
      if (doc?.cover_i) {
        return `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
      }
    }
  } catch (e) { /* continue */ }

  // --- SOURCE 4: Gutendex (Project Gutenberg - Excellent for public domain classics) ---
  try {
    // Search just by title in Gutenberg as author names format varies wildly
    const res = await fetchWithTimeout(`https://gutendex.com/books?search=${encodeURIComponent(cleanTitle)}`);
    if (res.ok) {
      const data = await res.json();
      // Filter to find a match that also somewhat matches author or just take the first popular one
      const book = data.results?.find((b: any) => 
        b.authors.some((a: any) => a.name.toLowerCase().includes(cleanAuthor.toLowerCase().split(' ')[0]))
      ) || data.results?.[0];

      if (book?.formats?.['image/jpeg']) {
        return book.formats['image/jpeg'];
      }
    }
  } catch (e) { /* continue */ }

  // --- SOURCE 5: Google Books (LOOSE SEARCH - Title Only) ---
  // Often imports have bad author names or "Unknown". This tries to find the most popular book with that title.
  try {
    const res = await fetchWithTimeout(`https://www.googleapis.com/books/v1/volumes?q=intitle:${encodedQueryLoose}&maxResults=1&printType=books&orderBy=relevance`);
    if (res.ok) {
      const data = await res.json();
      const item = data.items?.[0];
      const imageLinks = item?.volumeInfo?.imageLinks;
      if (imageLinks?.thumbnail) {
        return imageLinks.thumbnail.replace('http://', 'https://').replace('&zoom=1', '');
      }
    }
  } catch (e) { /* continue */ }

  // --- FALLBACK: Generated Placeholder ---
  return `https://ui-avatars.com/api/?name=${encodedQueryLoose}&background=e2e8f0&color=475569&size=512&font-size=0.33&length=2&bold=true&format=svg`;
};
