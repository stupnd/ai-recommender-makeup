import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import "./App.css";

function App() {
  const [showLanding, setShowLanding] = useState(true);
  const [recommended, setRecommended] = useState([]);
  const [image, setImage] = useState(null);
  const [finish, setFinish] = useState("");
  const [skinType, setSkinType] = useState("");
  const [budget, setBudget] = useState("");
  const [preview, setPreview] = useState(null);
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const OPENAI_KEY = import.meta.env.VITE_OPENAI_API_KEY;
  const RAPIDAPI_KEY = import.meta.env.VITE_RAPIDAPI_KEY;

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

  const handleStart = () => setShowLanding(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setRecommended([]);

    try {
      if (!image) throw new Error("Please upload a clear photo of your face");
      if (selectedTypes.length === 0)
        throw new Error("Please select at least one product type");
      if (!OPENAI_KEY || !RAPIDAPI_KEY)
        throw new Error("API configuration error");
      if (!budget || isNaN(budget))
        throw new Error("Please enter a valid budget");

      const allKeywords = {};

      for (const type of selectedTypes) {
        const keywordPrompt = `Generate a Sephora search keyword for the following preferences:\n- Product type: ${type}\n- Finish: ${finish}\n- Skin type: ${skinType}\n- Budget: $${budget}`;

        const keywordResponse = await fetch(
          "https://api.openai.com/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${OPENAI_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "gpt-3.5-turbo",
              messages: [
                {
                  role: "system",
                  content: "You're an expert in search keyword optimization.",
                },
                { role: "user", content: keywordPrompt },
              ],
              temperature: 0.5,
            }),
          }
        );

        const keywordData = await keywordResponse.json();
        const keyword = keywordData.choices[0].message.content.trim();
        allKeywords[type] = keyword;
      }

      const allResults = [];

      for (const type of selectedTypes) {
        const keyword = allKeywords[type];
        const searchUrl = `https://sephora.p.rapidapi.com/us/products/v2/search?q=${encodeURIComponent(
          keyword
        )}&pageSize=10&currentPage=1`;

        const res = await fetch(searchUrl, {
          method: "GET",
          headers: {
            "X-RapidAPI-Key": RAPIDAPI_KEY,
            "X-RapidAPI-Host": "sephora.p.rapidapi.com",
          },
        });

        const data = await res.json();
        const products = data.products?.slice(0, 5) || [];

        const aiRankingPrompt = `Given this user profile:\n- Skin Type: ${skinType}\n- Finish: ${finish}\n- Budget: $${budget}\n\nPick the 2 best ${type} products from this list:\n${products
          .map(
            (p, i) =>
              `${i + 1}. ${p.brandName} - ${p.displayName} - ${
                p.currentSku.listPrice
              }\nImage: ${p.heroImage}\nLink: https://www.sephora.com${p.targetUrl}`
          )
          .join("\n\n")}\n\nReturn in this exact format as a JSON array:\n[\n  {\n    "name": "",
    "brand": "",
    "price": "",
    "why": "",
    "image": "heroImage URL here",
    "link": "https://www.sephora.com/... full URL"
  }
]`;

        const aiRankRes = await fetch(
          "https://api.openai.com/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${OPENAI_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "gpt-3.5-turbo",
              messages: [
                {
                  role: "system",
                  content: "You are a helpful beauty product expert.",
                },
                { role: "user", content: aiRankingPrompt },
              ],
              temperature: 0.7,
            }),
          }
        );

        const rankData = await aiRankRes.json();
        const content = rankData.choices?.[0]?.message?.content || "";
        const cleaned = content.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(cleaned);
        allResults.push(...parsed);
      }

      setRecommended(allResults);
    } catch (err) {
      console.error("Error:", err);
      setError(err.message || "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  if (showLanding) {
    return (
      <div className="landing-page">
        <div className="landing-card">
          <h1>
            Explore<br />Book And<br /><span>Wander ✻</span><br />With <span>Ease</span>
          </h1>
          <button className="start-button" onClick={handleStart}>
            Start Your Journey
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app dark-ui">
      <div className="wizard-container">
        <div className="wizard-illustration">
          <img src="/illustration.png" alt="Makeup Matchmaker" />
        </div>

        <form onSubmit={handleSubmit} className="wizard-form">
          <div className="wizard-content">
            <h2>Find Your Perfect Match ✨</h2>

            <input type="file" accept="image/*" onChange={handleImageChange} disabled={isLoading} />
            {preview && <img src={preview} alt="Preview" className="photo-preview" />}

            <select value={finish} onChange={(e) => setFinish(e.target.value)} disabled={isLoading}>
              <option value="">Preferred Finish</option>
              <option value="matte">Matte</option>
              <option value="dewy">Dewy</option>
              <option value="natural">Natural</option>
            </select>

            <select value={skinType} onChange={(e) => setSkinType(e.target.value)} disabled={isLoading}>
              <option value="">Skin Type</option>
              <option value="dry">Dry</option>
              <option value="oily">Oily</option>
              <option value="combo">Combination</option>
              <option value="normal">Normal</option>
            </select>

            <input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="Budget in USD" disabled={isLoading} />

            <div className="checkbox-group">
              {[
                "foundation",
                "blush",
                "lipstick",
                "eyeshadow",
              ].map((type) => (
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
            </div>

            <button type="submit" disabled={isLoading} className="submit-button">
              {isLoading ? "Matching..." : "Find My Match"}
            </button>

            {error && <div className="error-message">{error}</div>}
          </div>
        </form>
      </div>

      {recommended.length > 0 && (
        <div className="recommendations">
          <h2>Results</h2>
          <div className="products-grid">
            {recommended.map((product, index) => (
              <div key={index} className="product-card">
                {product.image && (
                  <img
                    src={product.image}
                    alt={product.name}
                    className="product-img"
                  />
                )}
                <h3>{product.brand} {product.name}</h3>
                <p>{product.price}</p>
                <p>{product.why}</p>
                {product.link && (
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
