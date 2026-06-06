// backend/routes/triage.js
// Uses Groq API (FREE) with llama-3.3-70b-versatile model

const express = require('express');
const rateLimit = require('express-rate-limit');
const Groq = require('groq-sdk');
const { requireAuth } = require('../middleware/auth');
const { saveConsultation, findByUser, findById } = require('../models/consultation');

const router = express.Router();

// Groq client - free API, extremely fast (LPU inference)
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const triageLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Consultation limit reached — please wait 15 minutes' },
});

const SYSTEM_PROMPT = `You are MediTriage AI, an AI-powered health consultation and triage assistant. You perform preliminary symptom assessment and guide patients toward the correct level of care. You are NOT a substitute for real medical advice — always remind users of this.

## TRIAGE FRAMEWORK

Assess every consultation and assign exactly one of four triage levels:

L1 — Self-Care (Green): Minor symptoms manageable at home. Examples: mild cold, minor headache, small cuts, mild indigestion. Recommend rest, OTC remedies, hydration.

L2 — GP/Doctor Visit (Amber): Symptoms requiring professional evaluation within 24–72 hours. Examples: persistent fever above 38.5°C for 2+ days, moderate pain (5–7/10), recurring symptoms, suspected UTI.

L3 — Urgent Care (Coral): Symptoms needing same-day medical attention. Examples: high fever, moderate breathing difficulty, severe vomiting/diarrhea, significant injury or possible infection.

L4 — Emergency (Red): Life-threatening symptoms. Examples: chest pain radiating to arm or jaw, stroke signs (face drooping, arm weakness, slurred speech), difficulty breathing, severe allergic reaction, unconsciousness, uncontrolled bleeding. IMMEDIATELY tell the user to call emergency services — 911 (US), 999 (UK), 112 (EU), or their local equivalent.

## REQUIRED OUTPUT FORMAT

Always include these three lines verbatim somewhere in your response (they are parsed programmatically):
TRIAGE_LEVEL: [L1|L2|L3|L4]
SEVERITY_SCORE: [1-10]
CARE_RECOMMENDATION: [a brief action phrase, e.g. "Rest and monitor symptoms" or "Visit GP within 48 hours"]

## RESPONSE STRUCTURE
1. Brief empathetic acknowledgment (1 sentence)
2. Symptom interpretation using careful language: "may indicate", "could suggest", "warrants evaluation for" — never diagnose definitively
3. The three TRIAGE metadata lines above
4. Actionable guidance: what to do now, what to monitor, red flag symptoms that would escalate care
5. One-sentence disclaimer

## BEHAVIOUR RULES
- For ANY chest pain, breathing difficulty, or stroke symptoms → L4 immediately, no exceptions
- For symptoms in children → always err one level higher
- Ask 1–2 focused follow-up questions if critical information is missing (duration, severity 1–10, associated symptoms)
- Keep responses under 220 words — concise but complete
- Tone: warm, professional, like a knowledgeable nurse practitioner who genuinely cares`;

function parseTriageData(text) {
  return {
    level:    text.match(/TRIAGE_LEVEL:\s*(L[1-4])/i)?.[1]?.toUpperCase() || null,
    severity: text.match(/SEVERITY_SCORE:\s*(\d+)/i)?.[1] || null,
    care:     text.match(/CARE_RECOMMENDATION:\s*(.+)/i)?.[1]?.trim() || null,
  };
}

// POST /api/triage/consult
router.post('/consult', requireAuth, triageLimiter, async (req, res) => {
  const { messages, sessionId } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0)
    return res.status(400).json({ error: 'Messages array is required' });

  const validMessages = messages.filter(m =>
    m && ['user', 'assistant'].includes(m.role) && typeof m.content === 'string' && m.content.trim()
  );

  if (validMessages.length === 0)
    return res.status(400).json({ error: 'No valid messages provided' });

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',   // best free model on Groq
      max_tokens: 1024,
      temperature: 0.4,                    // lower = more consistent medical info
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...validMessages
      ],
    });

    const aiText = completion.choices[0]?.message?.content || '';
    const triageData = parseTriageData(aiText);

    const sid = sessionId || `session-${Date.now()}`;
    const allMessages = [...validMessages, { role: 'assistant', content: aiText }];

    const consultation = await saveConsultation({
      userId: req.user.id,
      sessionId: sid,
      messages: allMessages,
      triageData,
    });

    return res.json({
      reply: aiText,
      triage: triageData,
      sessionId: sid,
      consultationId: consultation?.id,
      model: completion.model,
    });
  } catch (err) {
    console.error('Triage API error:', err);
    if (err.status === 401)
      return res.status(500).json({ error: 'AI service auth failed — check GROQ_API_KEY in .env' });
    if (err.status === 429)
      return res.status(429).json({ error: 'AI rate limit reached — please wait a moment' });
    return res.status(500).json({ error: 'Consultation failed — please try again' });
  }
});

// GET /api/triage/history
router.get('/history', requireAuth, async (req, res) => {
  try {
    const consultations = await findByUser(req.user.id, 50);
    return res.json({ consultations });
  } catch (err) {
    console.error('History error:', err);
    return res.status(500).json({ error: 'Failed to retrieve history' });
  }
});

// GET /api/triage/history/:id
router.get('/history/:id', requireAuth, async (req, res) => {
  try {
    const consultation = await findById(req.params.id);
    if (!consultation) return res.status(404).json({ error: 'Consultation not found' });
    if (consultation.user_id !== req.user.id) return res.status(403).json({ error: 'Access denied' });
    return res.json({ consultation });
  } catch (err) {
    console.error('Consultation fetch error:', err);
    return res.status(500).json({ error: 'Failed to retrieve consultation' });
  }
});

module.exports = router;
