import React, { useState, useEffect, useCallback } from 'react';
import Anthropic from '@anthropic-ai/sdk';

// ─── Constants ───────────────────────────────────────────────────────────────

const TOPICS = [
  {
    id: 'atoms',
    name: 'Atoms and Ions',
    emoji: '⚛️',
    color: '#818cf8',
    bg: '#312e81',
    desc: 'Atomic structure, electron shells, ions & bonding',
  },
  {
    id: 'metals',
    name: 'Reactivity of Metals',
    emoji: '🔥',
    color: '#fb923c',
    bg: '#7c2d12',
    desc: 'Reactivity series, displacement & extraction',
  },
  {
    id: 'salts',
    name: 'Making Salts',
    emoji: '🧪',
    color: '#34d399',
    bg: '#064e3b',
    desc: 'Neutralisation, precipitation & crystallisation',
  },
  {
    id: 'rates',
    name: 'Rates of Reaction',
    emoji: '⚡',
    color: '#fbbf24',
    bg: '#78350f',
    desc: 'Collision theory, factors & measuring rates',
  },
];

const STORAGE_HISTORY = 'chemQuiz_history_v1';
const STORAGE_QUESTIONS = 'chemQuiz_questions_v1';

const LOADING_MSGS = [
  'Mixing up some questions… 🧪',
  'Checking the reactivity series… 🔥',
  'Counting electrons… ⚛️',
  'Balancing equations… ⚖️',
  'Almost ready! ✨',
];

const TOPIC_PROMPTS = {
  atoms: `Atoms and Ions for UK Year 9 chemistry. Cover: atomic structure (protons, neutrons, electrons), atomic number and mass number, isotopes, electron configuration/shells, the periodic table (groups, periods, metals vs non-metals), ion formation (gaining/losing electrons to become stable), ionic bonding, relative atomic mass, dot-and-cross diagrams, and the structure of the atom (nucleus vs electron shells).`,
  metals: `Reactivity of Metals for UK Year 9 chemistry. Cover: the reactivity series (potassium down to copper and silver), reactions of metals with water and dilute acid, displacement reactions (more reactive metal displaces less reactive one from solution), extraction of metals from ores, reduction using carbon (blast furnace), thermite reaction, oxidation and reduction definitions, rusting and corrosion prevention methods, and everyday uses of metals.`,
  salts: `Making Salts for UK Year 9 chemistry. Cover: acids (hydrochloric, sulfuric, nitric) and alkalis/bases, the pH scale, neutralisation reactions (acid + alkali gives salt + water), making soluble salts using acid + metal / acid + metal oxide / acid + carbonate, titration method, making insoluble salts by precipitation (mixing two solutions), evaporation and crystallisation to obtain solid salt, naming salts correctly (e.g. copper sulfate, sodium chloride, calcium nitrate), and writing word equations.`,
  rates: `Rates of Reaction for UK Year 9 chemistry. Cover: collision theory (particles must collide with enough energy), factors affecting rate (temperature, concentration, surface area/particle size, catalysts, light), how each factor increases/decreases rate and why (in terms of collisions), measuring rate of reaction (gas collection, mass loss, colour change, light transmission), interpreting rate graphs (steep gradient = fast, flat = reaction stopped), activation energy concept, how catalysts lower activation energy, and real-world examples (enzymes as biological catalysts, iron catalyst in Haber process).`,
};

// ─── Anthropic client ────────────────────────────────────────────────────────

const client = new Anthropic({
  apiKey: process.env.REACT_APP_ANTHROPIC_API_KEY || '',
  dangerouslyAllowBrowser: true,
});

// ─── Storage helpers ──────────────────────────────────────────────────────────

const getHistory = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_HISTORY) || '[]');
  } catch {
    return [];
  }
};

const saveHistory = (h) => localStorage.setItem(STORAGE_HISTORY, JSON.stringify(h));

const getCachedQs = (id) => {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_QUESTIONS) || '{}');
    return all[id] || null;
  } catch {
    return null;
  }
};

const cacheQs = (id, qs) => {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_QUESTIONS) || '{}');
    all[id] = qs;
    localStorage.setItem(STORAGE_QUESTIONS, JSON.stringify(all));
  } catch {}
};

const clearCachedQs = () => localStorage.removeItem(STORAGE_QUESTIONS);

// ─── Question generation ──────────────────────────────────────────────────────

async function generateQuestions(topicId) {
  const prompt = `You are a friendly Year 9 chemistry teacher creating a quiz for 14-year-old students.

Generate EXACTLY 40 multiple choice questions about: ${TOPIC_PROMPTS[topicId]}

Rules:
- Mix of difficulty: roughly 14 easy, 16 medium, 10 challenging
- Clear, friendly language a 14-year-old can understand
- Each question has exactly ONE correct answer
- Explanations should be encouraging, accurate, and 1-2 sentences
- Spread questions across all subtopics listed above
- No trick questions or ambiguous wording

Return ONLY a valid JSON array with no markdown, no code fences, no extra text. Exactly 40 objects in this format:
[
  {
    "question": "Question text here?",
    "options": {"A": "First option", "B": "Second option", "C": "Third option", "D": "Fourth option"},
    "correct": "A",
    "explanation": "Brief encouraging explanation of the correct answer.",
    "subtopic": "Specific subtopic name"
  }
]`;

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 8192,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].text.trim();

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('Could not parse questions from API response.');
    parsed = JSON.parse(match[0]);
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('API returned an unexpected format. Please try again.');
  }
  return parsed;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

const calcPct = (score, total) => Math.round((score / total) * 100);

const getWeakAreas = (history, topicId) => {
  const sessions = history.filter((s) => s.topicId === topicId);
  if (!sessions.length) return [];
  const counts = {};
  sessions.forEach((s) => {
    Object.entries(s.wrongSubtopics || {}).forEach(([sub, n]) => {
      counts[sub] = (counts[sub] || 0) + n;
    });
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, errors]) => ({ name, errors }));
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(160deg, #0f172a 0%, #1e1b4b 55%, #0f172a 100%)',
    color: '#f1f5f9',
    fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
    padding: '16px',
  },
  container: {
    maxWidth: 640,
    margin: '0 auto',
    paddingBottom: 48,
  },
  header: {
    textAlign: 'center',
    padding: '32px 0 8px',
  },
  title: {
    fontSize: 30,
    fontWeight: 900,
    margin: '0 0 8px',
    background: 'linear-gradient(135deg, #818cf8 30%, #34d399 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  subtitle: {
    color: '#94a3b8',
    margin: 0,
    fontSize: 15,
  },
  topicGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 14,
    margin: '24px 0',
  },
  topicCard: {
    borderRadius: 16,
    padding: '20px 14px',
    cursor: 'pointer',
    color: '#f1f5f9',
    textAlign: 'center',
    border: '1px solid transparent',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
  },
  topicEmoji: { fontSize: 36 },
  topicName: { margin: 0, fontSize: 14, fontWeight: 700, lineHeight: 1.3 },
  topicDesc: { margin: 0, color: '#94a3b8', fontSize: 11, lineHeight: 1.4 },
  badge: {
    padding: '3px 10px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
  },
  progressBtn: {
    width: '100%',
    padding: '14px',
    background: 'rgba(30,41,59,0.7)',
    border: '1px solid rgba(148,163,184,0.2)',
    borderRadius: 12,
    color: '#94a3b8',
    cursor: 'pointer',
    fontSize: 15,
    fontWeight: 600,
  },
  sectionTitle: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: 600,
    margin: '20px 0 8px',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  recentCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 14px',
    background: 'rgba(30,41,59,0.6)',
    borderRadius: 10,
    marginBottom: 8,
    fontSize: 14,
    color: '#cbd5e1',
  },
  spinner: {
    width: 52,
    height: 52,
    border: '4px solid rgba(129,140,248,0.2)',
    borderTopColor: '#818cf8',
    borderRadius: '50%',
    animation: 'spin 0.9s linear infinite',
  },
  loadingWrap: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    minHeight: '100vh',
    padding: 24,
  },
  quizHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingTop: 8,
  },
  scoreBadge: {
    background: 'rgba(251,191,36,0.15)',
    color: '#fbbf24',
    padding: '6px 14px',
    borderRadius: 999,
    fontSize: 14,
    fontWeight: 700,
  },
  progressBar: {
    height: 6,
    background: 'rgba(148,163,184,0.1)',
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: 18,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    transition: 'width 0.4s ease',
  },
  questionCard: {
    background: 'rgba(30,41,59,0.8)',
    borderRadius: 16,
    padding: '20px',
    marginBottom: 14,
  },
  questionText: {
    fontSize: 17,
    lineHeight: 1.6,
    margin: '0 0 12px',
    color: '#f1f5f9',
  },
  subtopicTag: {
    display: 'inline-block',
    padding: '3px 10px',
    border: '1px solid',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 600,
  },
  optionsGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    marginBottom: 14,
  },
  optionBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    padding: '13px 16px',
    background: 'rgba(30,41,59,0.8)',
    border: '1px solid rgba(148,163,184,0.2)',
    borderRadius: 12,
    color: '#f1f5f9',
    cursor: 'pointer',
    fontSize: 15,
    textAlign: 'left',
  },
  optionCorrect: {
    background: 'rgba(52,211,153,0.15)',
    border: '1px solid #34d399',
    color: '#34d399',
  },
  optionWrong: {
    background: 'rgba(251,146,60,0.15)',
    border: '1px solid #fb923c',
    color: '#fb923c',
  },
  optionLetter: {
    width: 30,
    height: 30,
    minWidth: 30,
    borderRadius: 8,
    background: 'rgba(148,163,184,0.1)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    fontWeight: 800,
    flexShrink: 0,
  },
  feedbackCard: {
    background: 'rgba(15,23,42,0.9)',
    border: '1px solid',
    borderRadius: 16,
    padding: '16px 20px',
    marginBottom: 14,
    fontSize: 14,
    lineHeight: 1.6,
  },
  nextBtn: {
    width: '100%',
    padding: '16px',
    border: 'none',
    borderRadius: 12,
    color: '#fff',
    cursor: 'pointer',
    fontSize: 16,
    fontWeight: 700,
    letterSpacing: 0.3,
  },
  reviseCard: {
    background: 'rgba(30,41,59,0.8)',
    border: '1px solid rgba(251,191,36,0.25)',
    borderRadius: 16,
    padding: '16px 20px',
    marginBottom: 20,
  },
  reviseItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
    borderBottom: '1px solid rgba(148,163,184,0.08)',
    fontSize: 14,
    color: '#cbd5e1',
    gap: 8,
  },
  resultBtns: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  btn: {
    padding: '14px',
    border: 'none',
    borderRadius: 12,
    color: '#fff',
    cursor: 'pointer',
    fontSize: 15,
    fontWeight: 600,
  },
  backBtn: {
    padding: '8px 16px',
    background: 'rgba(30,41,59,0.8)',
    border: '1px solid rgba(148,163,184,0.2)',
    borderRadius: 10,
    color: '#94a3b8',
    cursor: 'pointer',
    fontSize: 14,
  },
  detailCard: {
    background: 'rgba(30,41,59,0.8)',
    borderRadius: 16,
    padding: '20px',
    marginTop: 8,
  },
};

// ─── HomeScreen ───────────────────────────────────────────────────────────────

function HomeScreen({ topics, onStart, onProgress, history }) {
  const recent = history.slice(0, 3);

  return (
    <div style={S.page}>
      <div style={S.container}>
        <div style={S.header}>
          <h1 style={S.title}>🧪 Year 9 Chemistry Quiz</h1>
          <p style={S.subtitle}>Master your chemistry topics one question at a time!</p>
        </div>

        <div style={S.topicGrid}>
          {topics.map((topic) => {
            const sessions = history.filter((h) => h.topicId === topic.id);
            const best = sessions.length
              ? Math.max(...sessions.map((s) => calcPct(s.score, s.total)))
              : null;
            return (
              <button
                key={topic.id}
                onClick={() => onStart(topic)}
                style={{
                  ...S.topicCard,
                  background: `linear-gradient(145deg, ${topic.bg}ee 0%, ${topic.bg}99 100%)`,
                  borderColor: topic.color + '55',
                }}
              >
                <span style={S.topicEmoji}>{topic.emoji}</span>
                <h3 style={S.topicName}>{topic.name}</h3>
                <p style={S.topicDesc}>{topic.desc}</p>
                <span style={{ color: '#64748b', fontSize: 11 }}>40 questions</span>
                {best !== null && (
                  <div style={{ ...S.badge, background: topic.color + '22', color: topic.color }}>
                    Best: {best}%
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {recent.length > 0 && (
          <>
            <div style={S.sectionTitle}>Recent Sessions</div>
            {recent.map((s) => {
              const t = TOPICS.find((t) => t.id === s.topicId);
              const p = calcPct(s.score, s.total);
              return (
                <div key={s.id} style={S.recentCard}>
                  <span>
                    {t?.emoji} {s.topicName}
                  </span>
                  <span
                    style={{
                      color: p >= 70 ? '#34d399' : p >= 50 ? '#fbbf24' : '#fb923c',
                      fontWeight: 700,
                    }}
                  >
                    {s.score}/{s.total} · {p}%
                  </span>
                </div>
              );
            })}
          </>
        )}

        <button
          onClick={onProgress}
          style={{ ...S.progressBtn, marginTop: recent.length ? 12 : 0 }}
        >
          📈 View Progress &amp; Weak Areas
        </button>
      </div>
    </div>
  );
}

// ─── LoadingScreen ────────────────────────────────────────────────────────────

function LoadingScreen({ message, topic }) {
  return (
    <div style={{ ...S.page, ...S.loadingWrap }}>
      <div style={S.spinner} />
      <h2
        style={{
          color: topic?.color || '#818cf8',
          textAlign: 'center',
          margin: 0,
          fontSize: 20,
        }}
      >
        Generating {topic?.name} questions…
      </h2>
      <p style={{ color: '#94a3b8', textAlign: 'center', margin: 0, fontSize: 16 }}>{message}</p>
      <p style={{ color: '#475569', textAlign: 'center', margin: 0, fontSize: 13 }}>
        This usually takes 15–30 seconds ⏰
      </p>
    </div>
  );
}

// ─── OptionButton ─────────────────────────────────────────────────────────────

function OptionButton({ letter, text, status, disabled, onClick }) {
  let style = { ...S.optionBtn };
  if (status === 'correct') style = { ...style, ...S.optionCorrect };
  else if (status === 'wrong') style = { ...style, ...S.optionWrong };
  else if (status === 'dim') style = { ...style, opacity: 0.35 };

  const letterStyle = { ...S.optionLetter };
  if (status === 'correct') letterStyle.background = 'rgba(52,211,153,0.25)';
  else if (status === 'wrong') letterStyle.background = 'rgba(251,146,60,0.25)';

  return (
    <button style={style} onClick={onClick} disabled={disabled}>
      <span style={letterStyle}>{letter}</span>
      <span>{text}</span>
    </button>
  );
}

// ─── QuizScreen ───────────────────────────────────────────────────────────────

function QuizScreen({ question, questionNum, total, selectedAnswer, score, onAnswer, onNext, onHome, topic }) {
  const answered = selectedAnswer !== null;
  const correct = selectedAnswer === question.correct;
  const progress = (questionNum / total) * 100;

  const getStatus = (letter) => {
    if (!answered) return 'neutral';
    if (letter === question.correct) return 'correct';
    if (letter === selectedAnswer) return 'wrong';
    return 'dim';
  };

  return (
    <div style={S.page}>
      <div style={S.container}>
        <div style={S.quizHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={onHome} style={S.backBtn}>🏠 Home</button>
            <div>
              <div style={{ color: topic.color, fontSize: 14, fontWeight: 700 }}>
                {topic.emoji} {topic.name}
              </div>
              <div style={{ color: '#64748b', fontSize: 12 }}>
                Question {questionNum} of {total}
              </div>
            </div>
          </div>
          <div style={S.scoreBadge}>⭐ {score}</div>
        </div>

        <div style={S.progressBar}>
          <div style={{ ...S.progressFill, width: `${progress}%`, background: topic.color }} />
        </div>

        <div style={S.questionCard}>
          <p style={S.questionText}>{question.question}</p>
          {question.subtopic && (
            <span
              style={{
                ...S.subtopicTag,
                borderColor: topic.color + '55',
                color: topic.color,
              }}
            >
              {question.subtopic}
            </span>
          )}
        </div>

        <div style={S.optionsGrid}>
          {['A', 'B', 'C', 'D'].map((letter) => (
            <OptionButton
              key={letter}
              letter={letter}
              text={question.options[letter]}
              status={getStatus(letter)}
              disabled={answered}
              onClick={() => onAnswer(letter)}
            />
          ))}
        </div>

        {answered && (
          <div
            style={{
              ...S.feedbackCard,
              borderColor: correct ? '#34d399' : '#fb923c',
            }}
          >
            <div style={{ fontSize: 20, marginBottom: 8, fontWeight: 700 }}>
              {correct ? '🎉 Correct!' : '❌ Not quite!'}
            </div>
            {!correct && (
              <p style={{ margin: '0 0 6px', color: '#94a3b8' }}>
                The correct answer was{' '}
                <strong style={{ color: '#34d399' }}>
                  {question.correct}: {question.options[question.correct]}
                </strong>
              </p>
            )}
            <p style={{ margin: 0, color: '#cbd5e1' }}>{question.explanation}</p>
          </div>
        )}

        {answered && (
          <button onClick={onNext} style={{ ...S.nextBtn, background: topic.color }}>
            {questionNum === total ? '🏁 See My Results' : 'Next Question →'}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── ResultScreen ─────────────────────────────────────────────────────────────

function ResultScreen({ score, total, topic, wrongAnswers, onRetry, onHome, onProgress }) {
  const p = calcPct(score, total);
  const grade =
    p >= 80
      ? { msg: 'Outstanding work! 🌟', color: '#fbbf24' }
      : p >= 60
      ? { msg: 'Great effort! 🎉', color: '#34d399' }
      : p >= 40
      ? { msg: 'Good start! Keep going! 💪', color: '#60a5fa' }
      : { msg: "Keep practising — you've got this! 🔥", color: '#fb923c' };

  const topWrong = Object.entries(
    wrongAnswers.reduce((acc, wa) => {
      if (wa.subtopic) acc[wa.subtopic] = (acc[wa.subtopic] || 0) + 1;
      return acc;
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  const trophy = p >= 80 ? '🏆' : p >= 60 ? '🥈' : p >= 40 ? '🥉' : '📚';

  return (
    <div style={S.page}>
      <div style={S.container}>
        <div style={{ textAlign: 'center', padding: '32px 0 24px' }}>
          <div style={{ fontSize: 72, marginBottom: 12 }}>{trophy}</div>
          <h2
            style={{ color: grade.color, fontSize: 24, margin: '0 0 12px', fontWeight: 800 }}
          >
            {grade.msg}
          </h2>
          <div
            style={{
              fontSize: 60,
              fontWeight: 900,
              color: '#fff',
              lineHeight: 1,
              margin: '0 0 8px',
            }}
          >
            {p}%
          </div>
          <p style={{ color: '#94a3b8', margin: 0 }}>
            {score} out of {total} correct · {topic.emoji} {topic.name}
          </p>
        </div>

        {topWrong.length > 0 && (
          <div style={S.reviseCard}>
            <h3 style={{ color: '#fbbf24', margin: '0 0 12px', fontSize: 15, fontWeight: 700 }}>
              📖 Top Areas to Revise
            </h3>
            {topWrong.map(([sub, count]) => (
              <div key={sub} style={S.reviseItem}>
                <span style={{ flex: 1 }}>{sub}</span>
                <span style={{ color: '#fb923c', fontWeight: 700, flexShrink: 0 }}>
                  {count} wrong
                </span>
              </div>
            ))}
          </div>
        )}

        {p === 100 && (
          <div
            style={{
              ...S.reviseCard,
              borderColor: '#34d39944',
              textAlign: 'center',
              padding: 24,
            }}
          >
            <div style={{ fontSize: 40 }}>🎯</div>
            <p style={{ color: '#34d399', margin: '8px 0 0', fontWeight: 700 }}>
              Perfect score! Absolutely brilliant!
            </p>
          </div>
        )}

        <div style={S.resultBtns}>
          <button onClick={onRetry} style={{ ...S.btn, background: topic.color }}>
            🔄 Try Again
          </button>
          <button onClick={onProgress} style={{ ...S.btn, background: '#1e3a5f' }}>
            📈 View Progress
          </button>
          <button
            onClick={onHome}
            style={{
              ...S.btn,
              background: 'transparent',
              border: '1px solid rgba(148,163,184,0.25)',
            }}
          >
            🏠 Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ProgressScreen ───────────────────────────────────────────────────────────

function ProgressScreen({ history, topics, onHome, onClearCache }) {
  const [selectedId, setSelectedId] = useState(null);

  const topicStats = topics.map((topic) => {
    const sessions = history.filter((h) => h.topicId === topic.id);
    if (!sessions.length)
      return { ...topic, sessions: [], avg: null, best: null, weakAreas: [] };
    const scores = sessions.map((s) => calcPct(s.score, s.total));
    return {
      ...topic,
      sessions,
      avg: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      best: Math.max(...scores),
      weakAreas: getWeakAreas(history, topic.id),
    };
  });

  const selected = selectedId ? topicStats.find((t) => t.id === selectedId) : null;

  return (
    <div style={S.page}>
      <div style={S.container}>
        <div style={S.quizHeader}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>📈 Your Progress</h2>
          <button onClick={onHome} style={S.backBtn}>
            ← Home
          </button>
        </div>

        {history.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#475569', padding: '60px 24px' }}>
            <div style={{ fontSize: 56, marginBottom: 12 }}>📊</div>
            <p style={{ fontSize: 15 }}>
              No quiz attempts yet. Start a topic to track your progress!
            </p>
          </div>
        ) : (
          <>
            <div style={S.topicGrid}>
              {topicStats.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedId(t.id === selectedId ? null : t.id)}
                  style={{
                    ...S.topicCard,
                    background: `linear-gradient(145deg, ${t.bg}ee 0%, ${t.bg}99 100%)`,
                    borderColor: t.id === selectedId ? t.color : t.color + '44',
                    opacity: t.sessions.length ? 1 : 0.45,
                  }}
                >
                  <span style={S.topicEmoji}>{t.emoji}</span>
                  <h3 style={S.topicName}>{t.name}</h3>
                  {t.avg !== null ? (
                    <>
                      <div style={{ color: t.color, fontWeight: 800, fontSize: 22 }}>
                        {t.avg}%
                      </div>
                      <div style={{ color: '#64748b', fontSize: 11 }}>
                        avg · {t.sessions.length} attempt
                        {t.sessions.length !== 1 ? 's' : ''}
                      </div>
                      <div style={{ color: '#94a3b8', fontSize: 11 }}>Best: {t.best}%</div>
                    </>
                  ) : (
                    <div style={{ color: '#475569', fontSize: 12 }}>Not attempted yet</div>
                  )}
                </button>
              ))}
            </div>

            {selected && selected.sessions.length > 0 && (
              <div style={S.detailCard}>
                <h3
                  style={{ color: selected.color, margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}
                >
                  {selected.emoji} {selected.name}
                </h3>

                {selected.weakAreas.length > 0 && (
                  <>
                    <div style={{ ...S.sectionTitle, margin: '0 0 8px' }}>
                      🎯 Top Areas to Revise
                    </div>
                    {selected.weakAreas.map((wa) => (
                      <div key={wa.name} style={S.reviseItem}>
                        <span style={{ flex: 1 }}>{wa.name}</span>
                        <span style={{ color: '#fb923c', fontWeight: 700 }}>
                          {wa.errors} error{wa.errors !== 1 ? 's' : ''}
                        </span>
                      </div>
                    ))}
                  </>
                )}

                <div style={{ ...S.sectionTitle, margin: '16px 0 8px' }}>📅 Recent Attempts</div>
                {selected.sessions.slice(0, 6).map((s) => {
                  const p = calcPct(s.score, s.total);
                  return (
                    <div key={s.id} style={S.reviseItem}>
                      <span style={{ color: '#64748b', fontSize: 13 }}>
                        {new Date(s.date).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                      <span
                        style={{
                          color: p >= 70 ? '#34d399' : p >= 50 ? '#fbbf24' : '#fb923c',
                          fontWeight: 700,
                        }}
                      >
                        {s.score}/{s.total} ({p}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={S.sectionTitle}>Settings</div>
            <button
              onClick={onClearCache}
              style={{
                ...S.btn,
                background: 'transparent',
                border: '1px solid rgba(148,163,184,0.2)',
                color: '#94a3b8',
                fontSize: 13,
              }}
            >
              🔄 Regenerate Questions (Clear Question Cache)
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── ErrorScreen ──────────────────────────────────────────────────────────────

function ErrorScreen({ error, onHome }) {
  const isApiKey =
    !process.env.REACT_APP_ANTHROPIC_API_KEY ||
    process.env.REACT_APP_ANTHROPIC_API_KEY === 'your_api_key_here' ||
    (error || '').toLowerCase().includes('401') ||
    (error || '').toLowerCase().includes('auth');

  return (
    <div style={{ ...S.page, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ ...S.container, textAlign: 'center', paddingTop: 80 }}>
        <div style={{ fontSize: 60, marginBottom: 12 }}>😬</div>
        <h2 style={{ color: '#fb923c', margin: '0 0 12px' }}>Oops! Something went wrong</h2>
        <p style={{ color: '#94a3b8', marginBottom: 8, lineHeight: 1.6 }}>
          {isApiKey
            ? 'Looks like the API key is missing or invalid.'
            : error}
        </p>
        {isApiKey && (
          <div
            style={{
              color: '#64748b',
              fontSize: 13,
              background: 'rgba(30,41,59,0.8)',
              padding: '12px 16px',
              borderRadius: 10,
              textAlign: 'left',
              fontFamily: 'monospace',
              marginBottom: 16,
            }}
          >
            Add your key to <strong style={{ color: '#818cf8' }}>.env</strong>:<br />
            <span style={{ color: '#34d399' }}>REACT_APP_ANTHROPIC_API_KEY=sk-ant-...</span>
            <br />
            Then restart the dev server.
          </div>
        )}
        <button onClick={onHome} style={{ ...S.btn, background: '#6366f1', marginTop: 8 }}>
          🏠 Go Home
        </button>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [screen, setScreen] = useState('home');
  const [currentTopic, setCurrentTopic] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [score, setScore] = useState(0);
  const [wrongAnswers, setWrongAnswers] = useState([]);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState(getHistory);

  // Inject keyframe animation for spinner
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  // Rotate loading messages while generating
  useEffect(() => {
    if (screen !== 'loading') return;
    const id = setInterval(
      () => setLoadingMsgIdx((i) => (i + 1) % LOADING_MSGS.length),
      2500
    );
    return () => clearInterval(id);
  }, [screen]);

  const startTopic = useCallback(async (topic) => {
    setCurrentTopic(topic);
    setScreen('loading');
    setError(null);
    try {
      let qs = getCachedQs(topic.id);
      if (!qs) {
        qs = await generateQuestions(topic.id);
        cacheQs(topic.id, qs);
      }
      setQuestions(shuffle(qs));
      setCurrentQ(0);
      setScore(0);
      setWrongAnswers([]);
      setSelectedAnswer(null);
      setScreen('quiz');
    } catch (err) {
      setError(err.message || String(err));
      setScreen('error');
    }
  }, []);

  const handleAnswer = useCallback(
    (letter) => {
      if (selectedAnswer !== null) return;
      setSelectedAnswer(letter);
      if (letter === questions[currentQ].correct) {
        setScore((s) => s + 1);
      } else {
        setWrongAnswers((wa) => [...wa, { ...questions[currentQ], userAnswer: letter }]);
      }
    },
    [selectedAnswer, questions, currentQ]
  );

  const nextQuestion = useCallback(() => {
    const isLast = currentQ + 1 >= questions.length;
    if (isLast) {
      const session = {
        id: Date.now(),
        date: new Date().toISOString(),
        topicId: currentTopic.id,
        topicName: currentTopic.name,
        score,
        total: questions.length,
        wrongSubtopics: wrongAnswers.reduce((acc, wa) => {
          if (wa.subtopic) acc[wa.subtopic] = (acc[wa.subtopic] || 0) + 1;
          return acc;
        }, {}),
      };
      const newHistory = [session, ...getHistory()].slice(0, 100);
      saveHistory(newHistory);
      setHistory(newHistory);
      setScreen('result');
    } else {
      setCurrentQ((q) => q + 1);
      setSelectedAnswer(null);
    }
  }, [currentQ, questions, currentTopic, score, wrongAnswers]);

  if (screen === 'home')
    return (
      <HomeScreen
        topics={TOPICS}
        onStart={startTopic}
        onProgress={() => setScreen('progress')}
        history={history}
      />
    );

  if (screen === 'loading')
    return <LoadingScreen message={LOADING_MSGS[loadingMsgIdx]} topic={currentTopic} />;

  if (screen === 'quiz')
    return (
      <QuizScreen
        question={questions[currentQ]}
        questionNum={currentQ + 1}
        total={questions.length}
        selectedAnswer={selectedAnswer}
        score={score}
        onAnswer={handleAnswer}
        onNext={nextQuestion}
        onHome={() => setScreen('home')}
        topic={currentTopic}
      />
    );

  if (screen === 'result')
    return (
      <ResultScreen
        score={score}
        total={questions.length}
        topic={currentTopic}
        wrongAnswers={wrongAnswers}
        onRetry={() => startTopic(currentTopic)}
        onHome={() => setScreen('home')}
        onProgress={() => setScreen('progress')}
      />
    );

  if (screen === 'progress')
    return (
      <ProgressScreen
        history={history}
        topics={TOPICS}
        onHome={() => setScreen('home')}
        onClearCache={() => {
          clearCachedQs();
          window.alert(
            'Question cache cleared! Fresh questions will be generated next time.'
          );
        }}
      />
    );

  if (screen === 'error')
    return <ErrorScreen error={error} onHome={() => setScreen('home')} />;

  return null;
}
