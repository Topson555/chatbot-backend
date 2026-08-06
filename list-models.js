import dotenv from 'dotenv';
dotenv.config();

async function checkModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (data.error) {
      console.error('API Error:', data.error.message);
      return;
    }

    console.log('\n--- Enabled Models For Your Key ---');
    const contentModels = data.models
      ?.filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m) => m.name.replace('models/', ''));

    console.log(contentModels);
  } catch (err) {
    console.error('Fetch failed:', err.message);
  }
}

checkModels();