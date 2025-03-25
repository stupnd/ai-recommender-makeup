import { useState } from 'react';
import './App.css';

function App() {
  const [recommended, setRecommended] = useState([]);
  const [image, setImage] = useState(null);
  const [finish, setFinish] = useState('');
  const [skinType, setSkinType] = useState('');
  const [budget, setBudget] = useState('');
  const [preview, setPreview] = useState(null);
  const [selectedTypes, setSelectedTypes] = useState([]);
  const HUGGINGFACE_TOKEN = process.env.REACT_APP_HF_TOKEN;


  const handleTypeChange = (e) => {
    const { value, checked } = e.target;
    setSelectedTypes(prev =>
      checked ? [...prev, value] : prev.filter(type => type !== value)
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

    const presignResponse = await fetch("https://7uzyofk8hc.execute-api.us-east-2.amazonaws.com/default/generatePresignedURL", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_name: image.name, file_type: image.type })
    });
    const result = await presignResponse.json();
    const { upload_url, key } = result;

    const uploadResponse = await fetch(upload_url, {
      method: "PUT",
      headers: { "Content-Type": image.type },
      body: image
    });

    if (!uploadResponse.ok) {
      return alert("❌ Upload to S3 failed");
    }

    const analyzeResponse = await fetch("https://423ot4cz0j.execute-api.us-east-2.amazonaws.com/default/analyzeSkinTone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key })
    });

    const analysis = await analyzeResponse.json();
    const estimatedTone = analysis.estimated_tone || 'medium';

    const productData = [];
    for (const type of selectedTypes) {
      const res = await fetch(`https://makeup-api.herokuapp.com/api/v1/products.json?product_type=${type}`);
      const data = await res.json();

      productData.push(...data.slice(0, 5).map(p => ({
        name: p.name,
        brand: p.brand,
        price: p.price,
        type: type,
        description: p.description || '',
        link: p.website_link
      })));
    }

    const aiPrompt = `You are a beauty expert. A user has:
- Skin tone: ${estimatedTone}
- Skin type: ${skinType}
- Finish: ${finish}
- Budget: $${budget}
- Wants: ${selectedTypes.join(", ")}

Here are 10 makeup products:
${productData.slice(0, 10).map((p, i) => `${i + 1}. "${p.name}" - ${p.description.slice(0, 60)}... ($${p.price})`).join("\n")}

Pick the best 3 for this user and explain why in simple JSON like:
[
  { "name": "____", "why": "____", "price": "$__" }
]`;

    const aiResponse = await fetch("https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${HUGGINGFACE_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ inputs: aiPrompt })
    });

    const aiResult = await aiResponse.json();
    try {
      const jsonStart = aiResult[0].generated_text.indexOf('[');
      const jsonStr = aiResult[0].generated_text.slice(jsonStart);
      const parsed = JSON.parse(jsonStr);
      setRecommended(parsed);
    } catch (err) {
      console.error("Error parsing AI response:", err);
      alert("AI recommendation failed.");
    }
  };

  return (
    <div className="App" style={{ padding: '2rem', maxWidth: '600px', margin: 'auto' }}>
      <h1>Makeup Matchmaker 💄</h1>

      <form onSubmit={handleSubmit}>
        <label>Upload a clear photo:</label>
        <input type="file" accept="image/*" onChange={handleImageChange} required />
        {preview && <img src={preview} alt="preview" style={{ width: '100px', marginTop: '10px' }} />}

        <div style={{ marginTop: '1rem' }}>
          <label>What finish do you prefer?</label><br />
          <select value={finish} onChange={(e) => setFinish(e.target.value)} required>
            <option value="">Select</option>
            <option value="matte">Matte</option>
            <option value="dewy">Dewy</option>
            <option value="natural">Natural</option>
          </select>
        </div>

        <div style={{ marginTop: '1rem' }}>
          <label>What's your skin type?</label><br />
          <select value={skinType} onChange={(e) => setSkinType(e.target.value)} required>
            <option value="">Select</option>
            <option value="dry">Dry</option>
            <option value="oily">Oily</option>
            <option value="combo">Combination</option>
            <option value="normal">Normal</option>
          </select>
        </div>

        <div style={{ marginTop: '1rem' }}>
          <label>What’s your budget? (in USD)</label><br />
          <input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} required />
        </div>

        <div style={{ marginTop: '1rem' }}>
          <label>Select what you're shopping for:</label><br />
          <label><input type="checkbox" value="foundation" onChange={handleTypeChange} /> Foundation</label><br />
          <label><input type="checkbox" value="blush" onChange={handleTypeChange} /> Blush</label><br />
          <label><input type="checkbox" value="lipstick" onChange={handleTypeChange} /> Lipstick</label><br />
        </div>

        <button type="submit" style={{ marginTop: '1rem' }}>Find My Match</button>
      </form>

      {recommended.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h2>AI's Top Matches ✨</h2>
          {recommended.map((product, index) => (
            <div key={index} style={{ border: '1px solid #ccc', borderRadius: '10px', padding: '1rem', marginBottom: '1rem' }}>
              <h3>{product.name}</h3>
              <p>{product.why}</p>
              <p>{product.price}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;