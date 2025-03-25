// src/utils/scraper.js
export const scrapeMakeupProducts = async (type) => {
    const SCRAPERAPI_KEY = import.meta.env.VITE_SCRAPERAPI_KEY;
    const typeUrls = {
      foundation: 'https://www.ulta.com/shop/makeup/face/foundation',
      blush: 'https://www.ulta.com/shop/makeup/cheek/blush',
      lipstick: 'https://www.ulta.com/shop/makeup/lips/lipstick'
    };
  
    try {
      const response = await fetch(
        `https://api.scraperapi.com/?api_key=${SCRAPERAPI_KEY}&url=${
          encodeURIComponent(typeUrls[type])
        }&render=true`
      );
      
      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
  
      // Extract product data - these selectors may need adjustment
      const products = Array.from(doc.querySelectorAll('.ProductCard')).slice(0, 8).map(card => {
        const name = card.querySelector('.ProductCard__title')?.textContent.trim();
        const brand = card.querySelector('.ProductCard__brand')?.textContent.trim();
        const price = card.querySelector('.ProductCard__price')?.textContent.trim();
        const link = card.querySelector('a')?.href;
        const image = card.querySelector('img')?.src;
        
        return {
          name: name || 'Unknown Product',
          brand: brand || 'Unknown Brand',
          price: price || 'Price unavailable',
          type,
          link: link ? `https://www.ulta.com${link}` : '#',
          image: image || ''
        };
      });
  
      return products.filter(p => p.name !== 'Unknown Product');
    } catch (error) {
      console.error(`Failed to scrape ${type}:`, error);
      return [];
    }
  };