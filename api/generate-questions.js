const Anthropic = require('@anthropic-ai/sdk');

const TOPIC_PROMPTS = {
  atoms: `Atoms and Ions for UK Year 9 chemistry. Cover: atomic structure (protons, neutrons, electrons), atomic number and mass number, isotopes, electron configuration/shells, the periodic table (groups, periods, metals vs non-metals), ion formation (gaining/losing electrons to become stable), ionic bonding, relative atomic mass, dot-and-cross diagrams, and the structure of the atom (nucleus vs electron shells).`,
  metals: `Reactivity of Metals for UK Year 9 chemistry. Cover: the reactivity series (potassium down to copper and silver), reactions of metals with water and dilute acid, displacement reactions (more reactive metal displaces less reactive one from solution), extraction of metals from ores, reduction using carbon (blast furnace), thermite reaction, oxidation and reduction definitions, rusting and corrosion prevention methods, and everyday uses of metals.`,
  salts: `Making Salts for UK Year 9 chemistry. Cover: acids (hydrochloric, sulfuric, nitric) and alkalis/bases, the pH scale, neutralisation reactions (acid + alkali gives salt + water), making soluble salts using acid + metal / acid + metal oxide / acid + carbonate, titration method, making insoluble salts by precipitation (mixing two solutions), evaporation and crystallisation to obtain solid salt, naming salts correctly (e.g. copper sulfate, sodium chloride, calcium nitrate), and writing word equations.`,
  rates: `Rates of Reaction for UK Year 9 chemistry. Cover: collision theory (particles must collide with enough energy), factors affecting rate (temperature, concentration, surface area/particle size, catalysts, light), how each factor increases/decreases rate and why (in terms of collisions), measuring rate of reaction (gas collection, mass loss, colour change, light transmission), interpreting rate graphs (steep gradient = fast, flat = reaction stopped), activation energy concept, how catalysts lower activation energy, and real-world examples (enzymes as biological catalysts, iron catalyst in Haber process).`,
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { topicId } = req.body;

  if (!TOPIC_PROMPTS[topicId]) {
    return res.status(400).json({ error: 'Invalid topic ID' });
  }

  const prompt = `You are a friendly Year 9 chemistry teacher creating a quiz for 14-year-old students.

Generate EXACTLY 20 multiple choice questions about: ${TOPIC_PROMPTS[topicId]}

IMPORTANT: You must produce exactly 20 questions — no more, no fewer. Count them as you write: question 1, question 2, … question 20.

Rules:
- Mix of difficulty: roughly 7 easy, 8 medium, 5 challenging
- Clear, friendly language a 14-year-old can understand
- Each question has exactly ONE correct answer
- Explanations should be encouraging, accurate, and 1-2 sentences
- Spread questions across all subtopics listed above
- No trick questions or ambiguous wording

Return ONLY a valid JSON array with no markdown, no code fences, no extra text. The array must contain exactly 20 objects in this format:
[
  {
    "question": "Question text here?",
    "options": {"A": "First option", "B": "Second option", "C": "Third option", "D": "Fourth option"},
    "correct": "A",
    "explanation": "Brief encouraging explanation of the correct answer.",
    "subtopic": "Specific subtopic name"
  }
]`;

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].text.trim();

    let questions;
    try {
      questions = JSON.parse(text);
    } catch {
      const match = text.match(/\[[\s\S]*\]/);
      if (!match) throw new Error('Could not parse questions from API response.');
      questions = JSON.parse(match[0]);
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error('API returned an unexpected format.');
    }

    // Accept 18–20; trim any surplus above 20
    const trimmed = questions.slice(0, 20);
    if (trimmed.length < 18) {
      throw new Error(`Expected 20 questions but only got ${trimmed.length}. Please try again.`);
    }

    res.status(200).json({ questions: trimmed });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to generate questions' });
  }
};
