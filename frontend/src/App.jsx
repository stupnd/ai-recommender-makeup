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
  
    // Step 1: Get pre-signed URL from Lambda
    const presignResponse = await fetch("https://7uzyofk8hc.execute-api.us-east-2.amazonaws.com/default/generatePresignedURL", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        file_name: image.name,
        file_type: image.type
      })
    });
  
    const result = await presignResponse.json();
    console.log("Lambda result:", result);
    const { upload_url, key } = result;
  
    // Step 2: Upload to S3 using the pre-signed URL
    const uploadResponse = await fetch(upload_url, {
      method: "PUT",
      headers: {
        "Content-Type": image.type
      },
      body: image
    });
  
    if (uploadResponse.ok) {
      console.log("✅ Image uploaded to S3 successfully!");
      console.log("📸 S3 key:", key);
      alert("Image uploaded! We can now analyze it.");
  
      // ✅ Step 3: Call analyzeSkinTone Lambda
      const analyzeResponse = await fetch("https://423ot4cz0j.execute-api.us-east-2.amazonaws.com/default/analyzeSkinTone", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ key }) // sending the S3 key
      });
  
      const analysis = await analyzeResponse.json();
      console.log("🔍 Skin tone analysis result:", analysis);
  
      if (analyzeResponse.ok) {
        alert(`Skin tone estimated: ${analysis.estimated_tone}`);
      } else {
        alert("❌ Failed to analyze image. Try again.");
      }
  
    } else {
      console.error("❌ Upload failed.");
      alert("Something went wrong while uploading the image.");
    }

    let allRecommended = [];

    for (const type of selectedTypes) {
      const apiRes = await fetch(`https://makeup-api.herokuapp.com/api/v1/products.json?product_type=${type}`);
      const products = await apiRes.json();
    
      const filtered = products.filter(product => {
        const productPrice = parseFloat(product.price);
        const lowerName = product.name?.toLowerCase() || '';
        const lowerDesc = product.description?.toLowerCase() || '';
        const matchFinish = finish && (lowerName.includes(finish.toLowerCase()) || lowerDesc.includes(finish.toLowerCase()));
        const matchBudget = !isNaN(productPrice) && productPrice <= parseFloat(budget);
    
        return matchFinish && matchBudget;
      });
    
      allRecommended.push(...filtered);
    }
    
    const topMatches = allRecommended.slice(0, 3);
    setRecommended(topMatches);
    


if (recommended.length > 0) {
  alert(`Found ${recommended.length} matches! First one: ${recommended[0].name} ($${recommended[0].price})`);
} else {
  alert("No matching products found. Try a higher budget or different finish!");
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
    <h2>Top Matches ✨</h2>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
      {recommended.map((product, index) => (
        <div key={index} style={{ border: '1px solid #ccc', borderRadius: '10px', padding: '1rem' }}>
          <img src={product.api_featured_image} alt={product.name} style={{ width: '100%', borderRadius: '8px' }} />
          <h3 style={{ fontSize: '1rem' }}>{product.name}</h3>
          <p style={{ margin: 0, fontStyle: 'italic' }}>{product.brand}</p>
          <p>${product.price}</p>
          <a href={product.website_link} target="_blank" rel="noreferrer">
            <button style={{ marginTop: '0.5rem' }}>View Product</button>
          </a>
        </div>
      ))}
    </div>
  </div>
)}

    </div>
  );
}

export default App;
