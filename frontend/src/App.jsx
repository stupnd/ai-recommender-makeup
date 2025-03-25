<script src="http://localhost:8097"></script>
import { useState, useEffect } from "react"; // Added useEffect import
import "./App.css";

function App() {
  const [recommended, setRecommended] = useState([]);
  const [image, setImage] = useState(null);
  const [finish, setFinish] = useState("");
  const [skinType, setSkinType] = useState("");
  const [budget, setBudget] = useState("");
  const [preview, setPreview] = useState(null);
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const HUGGINGFACE_TOKEN = import.meta.env.VITE_HF_TOKEN;

  // Removed the MediaSession effect since it was causing issues
  // and isn't necessary for our functionality

  const handleTypeChange = (e) => {
    const { value, checked } = e.target;
    setSelectedTypes((prev) =>
      checked ? [...prev, value] : prev.filter((type) => type !== value)
    );
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setImage(file);
    setPreview(URL.createObjectURL(file));
  };

  const getMakeupProducts = async (type) => {
    try {
      const res = await fetch(
        `https://makeup-api.herokuapp.com/api/v1/products.json?product_type=${type}`
      );
      const data = await res.json();
      return data.slice(0, 5).map((p) => ({
        name: p.name,
        brand: p.brand || "Unknown Brand",
        price: p.price || "Price unavailable",
        type,
        link: p.website_link || "#",
        image: p.api_featured_image || "",
      }));
    } catch (err) {
      console.error(`Makeup API failed for ${type}:`, err);
      return [];
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setRecommended([]);

    try {
      // Validate inputs
      if (!image) throw new Error("Please upload a clear photo of your face");
      if (selectedTypes.length === 0) throw new Error("Please select at least one product type");
      if (!HUGGINGFACE_TOKEN) throw new Error("API configuration error");
      if (!budget || isNaN(budget)) throw new Error("Please enter a valid budget");

      // Get products
      const productData = [];
      for (const type of selectedTypes) {
        const products = await getMakeupProducts(type);
        productData.push(...products);
        await new Promise(resolve => setTimeout(resolve, 500)); // Rate limiting
      }

      if (productData.length === 0) throw new Error("No products found for selected categories");

      // Filter by budget
      const budgetNum = Number(budget);
      const filteredProducts = productData.filter((p) => {
        const priceNum = parseFloat(p.price?.replace(/[^\d.]/g, "")) || 0;
        return priceNum <= budgetNum;
      });

      if (filteredProducts.length === 0) {
        throw new Error(`No products found within your $${budget} budget`);
      }

      // Prepare AI prompt
      const aiPrompt = `[INST] As a professional makeup artist, recommend 3-5 products from this list:
${filteredProducts.map((p, i) => `${i+1}. ${p.brand} ${p.name} (${p.type}) - ${p.price}`).join("\n")}

User Profile:
- Skin Type: ${skinType}
- Preferred Finish: ${finish}
- Budget: $${budget}

Requirements:
1. Include at least one product from each selected category
2. Prioritize products matching the user's skin type and finish preference
3. Stay within budget

Return ONLY a valid JSON array in this format:
[{
  "name": "Product Name",
  "brand": "Brand Name",
  "type": "product type",
  "price": "XX.XX",
  "why": "Brief explanation",
  "link": "product_url"
}]
[/INST]`;

      const aiResponse = await fetch(
        "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${HUGGINGFACE_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputs: aiPrompt,
            parameters: {
              return_full_text: false,
              max_new_tokens: 600,
            },
          }),
        }
      );

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        throw new Error(`AI API error: ${errorText}`);
      }

      const aiResult = await aiResponse.json();
      const responseText = aiResult[0]?.generated_text || "";
      
      // Improved JSON parsing
      let recommendations = [];
      try {
        const jsonStart = responseText.indexOf("[");
        const jsonEnd = responseText.lastIndexOf("]") + 1;
        if (jsonStart >= 0 && jsonEnd > jsonStart) {
          recommendations = JSON.parse(responseText.slice(jsonStart, jsonEnd));
        }
      } catch (parseError) {
        console.error("Failed to parse AI response:", parseError);
        throw new Error("Couldn't understand the AI's recommendations");
      }

      if (!Array.isArray(recommendations) || recommendations.length === 0) {
        throw new Error("No valid recommendations received");
      }

      setRecommended(recommendations);
    } catch (err) {
      console.error("Error:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app">
      <h1>Makeup Matchmaker 💄</h1>

      <form onSubmit={handleSubmit} className="form">
        <div className="form-group">
          <label>
            Upload a clear photo:
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              required
              disabled={isLoading}
            />
          </label>
          {preview && (
            <img
              src={preview}
              alt="Preview"
              className="preview-image"
            />
          )}
        </div>

        <div className="form-group">
          <label>
            What finish do you prefer?
            <select
              value={finish}
              onChange={(e) => setFinish(e.target.value)}
              required
              disabled={isLoading}
            >
              <option value="">Select</option>
              <option value="matte">Matte</option>
              <option value="dewy">Dewy</option>
              <option value="natural">Natural</option>
            </select>
          </label>
        </div>

        <div className="form-group">
          <label>
            What's your skin type?
            <select
              value={skinType}
              onChange={(e) => setSkinType(e.target.value)}
              required
              disabled={isLoading}
            >
              <option value="">Select</option>
              <option value="dry">Dry</option>
              <option value="oily">Oily</option>
              <option value="combo">Combination</option>
              <option value="normal">Normal</option>
            </select>
          </label>
        </div>

        <div className="form-group">
          <label>
            What's your budget? (USD)
            <input
              type="number"
              min="1"
              step="1"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              required
              disabled={isLoading}
            />
          </label>
        </div>

        <div className="form-group">
          <fieldset>
            <legend>Select product types:</legend>
            {["foundation", "blush", "lipstick", "eyeshadow"].map((type) => (
              <label key={type} className="checkbox-label">
                <input
                  type="checkbox"
                  value={type}
                  checked={selectedTypes.includes(type)}
                  onChange={handleTypeChange}
                  disabled={isLoading}
                />
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </label>
            ))}
          </fieldset>
        </div>

        <button type="submit" disabled={isLoading} className="submit-button">
          {isLoading ? "Finding Your Matches..." : "Get Recommendations"}
        </button>
      </form>

      {error && <div className="error-message">{error}</div>}

      {isLoading && <div className="loading-message">Analyzing your preferences...</div>}

      {recommended.length > 0 && (
        <div className="recommendations">
          <h2>Your Personalized Recommendations</h2>
          <div className="products-grid">
            {recommended.map((product, index) => (
              <div key={index} className="product-card">
                <h3>{product.brand} {product.name}</h3>
                <p className="product-type">{product.type}</p>
                <p className="product-price">{product.price}</p>
                <p className="product-reason">{product.why}</p>
                {product.link && product.link !== "#" && (
                  <a
                    href={product.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="product-link"
                  >
                    View Product
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;