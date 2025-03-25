import { useState } from "react";
import "./App.css";

function App() {
  const [recommended, setRecommended] = useState([]);
  const [image, setImage] = useState(null);
  const [finish, setFinish] = useState("");
  const [skinType, setSkinType] = useState("");
  const [budget, setBudget] = useState("");
  const [preview, setPreview] = useState(null);
  const [selectedTypes, setSelectedTypes] = useState([]);
  const HUGGINGFACE_TOKEN = import.meta.env.VITE_HF_TOKEN;

  const handleTypeChange = (e) => {
    const { value, checked } = e.target;
    setSelectedTypes((prev) =>
      checked ? [...prev, value] : prev.filter((type) => type !== value)
    );
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    setImage(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!image) return alert("Please upload an image!");
    if (selectedTypes.length === 0) return alert("Please select at least one product type!");

    if (!HUGGINGFACE_TOKEN) {
      alert("Missing API token - check your environment variables");
      return;
    }

    try{
    const presignResponse = await fetch(
      "https://7uzyofk8hc.execute-api.us-east-2.amazonaws.com/default/generatePresignedURL",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_name: image.name, file_type: image.type }),
      }
    );
    const result = await presignResponse.json();
    const { upload_url, key } = result;

    const uploadResponse = await fetch(upload_url, {
      method: "PUT",
      headers: { "Content-Type": image.type },
      body: image,
    });

    if (!uploadResponse.ok) {
      return alert("❌ Upload to S3 failed");
    }

    const analyzeResponse = await fetch(
      "https://423ot4cz0j.execute-api.us-east-2.amazonaws.com/default/analyzeSkinTone",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      }
    );

    const analysis = await analyzeResponse.json();
    const estimatedTone = analysis.estimated_tone || "medium";

    const productData = [];
    for (const type of selectedTypes) {
      const res = await fetch(`https://makeup-api.herokuapp.com/api/v1/products.json?product_type=${type}`);
      const data = await res.json();
      
      if (data && data.length > 0) {
        productData.push(...data.slice(0, 8).map(p => ({ // Get 8 products per type now
          name: p.name,
          brand: p.brand,
          price: p.price,
          type: type,
          description: p.description || 'No description available',
          link: p.website_link
        })));
      }
    }

    if (productData.length === 0) {
      return alert("No products found for the selected types!");
    }

    // More explicit prompt with JSON examples
    const aiPrompt = `[INST] You are a beauty expert recommending makeup products. 
Provide exactly ${selectedTypes.length * 1} recommendations in valid JSON format (at least 1 per selected type):
[
  { 
    "name": "Product Name", 
    "why": "Brief explanation why this suits the user", 
    "price": "XX.XX",
    "type": "product_type"
  }
]

User details:
- Skin tone: ${estimatedTone}
- Skin type: ${skinType}
- Finish: ${finish}
- Budget: $${budget}
- Wants: ${selectedTypes.join(", ")}

Available products:
${productData.slice(0, 15).map((p, i) => `${i + 1}. ${p.name} (${p.brand}) - ${p.type} - $${p.price}`).join("\n")}

Recommend at least 1 product per selected type (${selectedTypes.join(", ")}), up to ${selectedTypes.length * 1} total products.
Prioritize products that match the user's skin tone, type, finish preference, and budget. 
Distribute recommendations evenly across the selected types. If the user selected 3 types, provide at least 1 recommendation per type.
Return ONLY the JSON array, nothing else. [/INST]`;
      
const aiResponse = await fetch("https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${HUGGINGFACE_TOKEN.trim()}`, // .trim() removes any accidental whitespace
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    inputs: aiPrompt,
    parameters: {
      return_full_text: false,
      max_new_tokens: 500
    }
  })
});

if (!aiResponse.ok) {
  const errorData = await aiResponse.json().catch(() => ({}));
  throw new Error(
    `AI request failed: ${aiResponse.status} - ${errorData.error || 'Unknown error'}`
  );
}

    const aiResult = await aiResponse.json();
    console.log("Raw AI response:", aiResult); // Debugging

    // Try to find JSON in the response
    let recommendations = [];
    if (Array.isArray(aiResult)) {
      const text = aiResult[0]?.generated_text || '';
      const jsonMatch = text.match(/\[.*\]/s); // Find first JSON array in response
      if (jsonMatch) {
        recommendations = JSON.parse(jsonMatch[0]);
      }
    }

    if (recommendations.length === 0) {
      throw new Error("Could not parse recommendations");
    }

    setRecommended(recommendations);
  } catch (err) {
    console.error("Error in handleSubmit:", err);
    alert(`Error: ${err.message}`);
  }
};


  return (
    <div
      className="App"
      style={{ padding: "2rem", maxWidth: "600px", margin: "auto" }}
    >
      <h1>Makeup Matchmaker 💄</h1>

      <form onSubmit={handleSubmit}>
        <label>Upload a clear photo:</label>
        <input
          type="file"
          accept="image/*"
          onChange={handleImageChange}
          required
        />
        {preview && (
          <img
            src={preview}
            alt="preview"
            style={{ width: "100px", marginTop: "10px" }}
          />
        )}

        <div style={{ marginTop: "1rem" }}>
          <label>What finish do you prefer?</label>
          <br />
          <select
            value={finish}
            onChange={(e) => setFinish(e.target.value)}
            required
          >
            <option value="">Select</option>
            <option value="matte">Matte</option>
            <option value="dewy">Dewy</option>
            <option value="natural">Natural</option>
          </select>
        </div>

        <div style={{ marginTop: "1rem" }}>
          <label>What's your skin type?</label>
          <br />
          <select
            value={skinType}
            onChange={(e) => setSkinType(e.target.value)}
            required
          >
            <option value="">Select</option>
            <option value="dry">Dry</option>
            <option value="oily">Oily</option>
            <option value="combo">Combination</option>
            <option value="normal">Normal</option>
          </select>
        </div>

        <div style={{ marginTop: "1rem" }}>
          <label>What’s your budget? (in USD)</label>
          <br />
          <input
            type="number"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            required
          />
        </div>

        <div style={{ marginTop: "1rem" }}>
          <label>Select what you're shopping for:</label>
          <br />
          <label>
            <input
              type="checkbox"
              value="foundation"
              onChange={handleTypeChange}
            />{" "}
            Foundation
          </label>
          <br />
          <label>
            <input type="checkbox" value="blush" onChange={handleTypeChange} />{" "}
            Blush
          </label>
          <br />
          <label>
            <input
              type="checkbox"
              value="lipstick"
              onChange={handleTypeChange}
            />{" "}
            Lipstick
          </label>
          <br />
        </div>

        <button type="submit" style={{ marginTop: "1rem" }}>
          Find My Match
        </button>
      </form>

      {recommended.length > 0 && (
  <div style={{ marginTop: '2rem' }}>
    <h2>AI's Top Matches ✨</h2>
    {selectedTypes.map(type => (
      <div key={type}>
        <h3>{type.charAt(0).toUpperCase() + type.slice(1)}</h3>
        {recommended
          .filter(product => product.type === type)
          .map((product, index) => (
            <div key={index} style={{ border: '1px solid #ccc', borderRadius: '10px', padding: '1rem', marginBottom: '1rem' }}>
              <h4>{product.name}</h4>
              <p>{product.why}</p>
              <p>Price: {product.price}</p>
            </div>
          ))}
      </div>
    ))}
  </div>
)}
    </div>
  );
}

export default App;
