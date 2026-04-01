import React, { useState, useEffect, useCallback } from 'react';
import { loginOrCreateUser, fetchSessions, saveSession } from './supabase';

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

const STORAGE_QUESTIONS = 'chemQuiz_questions_v3'; // v3: enforce exactly 20
const STORAGE_USERNAME = 'chemQuiz_username';
const STORAGE_USER_ID = 'chemQuiz_userId';

const LOADING_MSGS = [
  'Mixing up some questions… 🧪',
  'Checking the reactivity series… 🔥',
  'Counting electrons… ⚛️',
  'Balancing equations… ⚖️',
  'Almost ready! ✨',
];

// ─── Storage helpers ──────────────────────────────────────────────────────────

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
  const response = await fetch('/api/generate-questions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topicId }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to generate questions');
  }

  return data.questions;
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
  input: {
    width: '100%',
    padding: '14px 16px',
    background: 'rgba(30,41,59,0.8)',
    border: '1px solid rgba(148,163,184,0.25)',
    borderRadius: 12,
    color: '#f1f5f9',
    fontSize: 16,
    outline: 'none',
    boxSizing: 'border-box',
  },
  userChip: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 12px',
    background: 'rgba(129,140,248,0.15)',
    border: '1px solid rgba(129,140,248,0.3)',
    borderRadius: 999,
    color: '#818cf8',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
};

// ─── UsernameScreen ───────────────────────────────────────────────────────────

function UsernameScreen({ savedUsername, onLogin }) {
  const [value, setValue] = useState(savedUsername || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = useCallback(async (name) => {
    const trimmed = (name ?? value).trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    try {
      await onLogin(trimmed);
    } catch (err) {
      setError(err.message || 'Could not connect. Check your internet connection.');
      setLoading(false);
    }
  }, [value, onLogin]);

  const handleKey = (e) => { if (e.key === 'Enter') handleSubmit(); };

  // Returning user on same device
  if (savedUsername) {
    return (
      <div style={{ ...S.page, ...S.loadingWrap }}>
        <div style={{ textAlign: 'center', maxWidth: 400, width: '100%' }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>👋</div>
          <h2 style={{ margin: '0 0 6px', fontSize: 22 }}>Welcome back!</h2>
          <p style={{ color: '#94a3b8', margin: '0 0 28px' }}>
            Continue as <strong style={{ color: '#818cf8' }}>{savedUsername}</strong>?
          </p>
          <button
            onClick={() => handleSubmit(savedUsername)}
            disabled={loading}
            style={{ ...S.nextBtn, background: '#6366f1', marginBottom: 12 }}
          >
            {loading ? 'Loading…' : `Continue as ${savedUsername}`}
          </button>
          <button
            onClick={() => { setValue(''); setError(null); }}
            style={{ ...S.btn, background: 'transparent', border: '1px solid rgba(148,163,184,0.2)', color: '#64748b', fontSize: 13 }}
          >
            Use a different username
          </button>
          {error && <p style={{ color: '#fb923c', marginTop: 12, fontSize: 14 }}>{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...S.page, ...S.loadingWrap }}>
      <div style={{ textAlign: 'center', maxWidth: 400, width: '100%' }}>
        <h1 style={{ ...S.title, fontSize: 28, marginBottom: 8 }}>🧪 Year 9 Chemistry Quiz</h1>
        <p style={{ color: '#94a3b8', margin: '0 0 32px', fontSize: 15, lineHeight: 1.6 }}>
          Pick a username to save your scores and track your progress across devices!
        </p>
        <input
          style={S.input}
          placeholder="Enter a username…"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKey}
          maxLength={30}
          autoFocus
        />
        <p style={{ color: '#475569', fontSize: 12, margin: '8px 0 20px', textAlign: 'left' }}>
          No password needed. Anyone with the same username can see your scores — pick something unique but not your real name!
        </p>
        <button
          onClick={() => handleSubmit()}
          disabled={loading || !value.trim()}
          style={{ ...S.nextBtn, background: value.trim() ? '#6366f1' : '#334155', opacity: value.trim() ? 1 : 0.6 }}
        >
          {loading ? 'Setting up…' : 'Start Quizzing! 🚀'}
        </button>
        {error && <p style={{ color: '#fb923c', marginTop: 12, fontSize: 14 }}>{error}</p>}
      </div>
    </div>
  );
}

// ─── HomeScreen ───────────────────────────────────────────────────────────────

function HomeScreen({ topics, onStart, onProgress, onSwitchUser, history, username }) {
  const recent = history.slice(0, 3);

  return (
    <div style={S.page}>
      <div style={S.container}>
        <div style={{ ...S.header, position: 'relative' }}>
          <button onClick={onSwitchUser} style={{ ...S.userChip, position: 'absolute', right: 0, top: 32 }}>
            👤 {username}
          </button>
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
                <span style={{ color: '#64748b', fontSize: 11 }}>20 questions</span>
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

                <div style={{ ...S.sectionTitle, margin: '16px 0 8px' }}>📅 Score History</div>
                {/* Header row */}
                <div style={{ ...S.reviseItem, borderBottom: '1px solid rgba(148,163,184,0.15)', paddingBottom: 6, marginBottom: 2 }}>
                  <span style={{ color: '#475569', fontSize: 11, fontWeight: 700, flex: 2 }}>DATE</span>
                  <span style={{ color: '#475569', fontSize: 11, fontWeight: 700, flex: 1, textAlign: 'center' }}>SCORE</span>
                  <span style={{ color: '#475569', fontSize: 11, fontWeight: 700, flex: 1, textAlign: 'center' }}>%</span>
                  <span style={{ color: '#475569', fontSize: 11, fontWeight: 700, flex: 1, textAlign: 'right' }}>TYPE</span>
                </div>
                {selected.sessions.map((s) => {
                  const p = calcPct(s.score, s.total);
                  const scoreColor = p >= 70 ? '#34d399' : p >= 50 ? '#fbbf24' : '#fb923c';
                  return (
                    <div key={s.id} style={{ ...S.reviseItem, alignItems: 'center' }}>
                      <span style={{ color: '#64748b', fontSize: 13, flex: 2 }}>
                        {new Date(s.date).toLocaleDateString('en-GB', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </span>
                      <span style={{ color: scoreColor, fontWeight: 700, fontSize: 13, flex: 1, textAlign: 'center' }}>
                        {s.score}/{s.total}
                      </span>
                      <span style={{ color: scoreColor, fontWeight: 700, fontSize: 13, flex: 1, textAlign: 'center' }}>
                        {p}%
                      </span>
                      <span style={{
                        flex: 1, textAlign: 'right', fontSize: 11, fontWeight: 700,
                        color: s.isPartial ? '#94a3b8' : '#34d399',
                      }}>
                        {s.isPartial ? '~ Partial' : '✓ Full'}
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
    (error || '').toLowerCase().includes('401') ||
    (error || '').toLowerCase().includes('auth') ||
    (error || '').toLowerCase().includes('api key');

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
            Set <span style={{ color: '#34d399' }}>ANTHROPIC_API_KEY</span> in your
            Vercel project environment variables and redeploy.
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
  const savedUsername = localStorage.getItem(STORAGE_USERNAME);
  const savedUserId = localStorage.getItem(STORAGE_USER_ID);

  const [screen, setScreen] = useState(savedUsername ? 'loading-user' : 'username');
  const [username, setUsername] = useState(savedUsername || '');
  const [userId, setUserId] = useState(savedUserId || null);
  const [currentTopic, setCurrentTopic] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [score, setScore] = useState(0);
  const [wrongAnswers, setWrongAnswers] = useState([]);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);

  // Inject keyframe animation for spinner
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  // Auto-login when stored credentials are present
  useEffect(() => {
    if (screen !== 'loading-user' || !savedUserId) return;
    fetchSessions(savedUserId)
      .then((sessions) => { setHistory(sessions); setScreen('home'); })
      .catch(() => setScreen('home'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleLogin = useCallback(async (rawUsername) => {
    const user = await loginOrCreateUser(rawUsername);
    localStorage.setItem(STORAGE_USERNAME, user.username);
    localStorage.setItem(STORAGE_USER_ID, user.id);
    setUsername(user.username);
    setUserId(user.id);
    const sessions = await fetchSessions(user.id);
    setHistory(sessions);
    setScreen('home');
  }, []);

  const handleSwitchUser = useCallback(() => {
    localStorage.removeItem(STORAGE_USERNAME);
    localStorage.removeItem(STORAGE_USER_ID);
    setUsername('');
    setUserId(null);
    setHistory([]);
    setScreen('username');
  }, []);

  // Called when user exits a quiz early via the Home button.
  // Saves a partial session if at least one question has been answered.
  const handleHomeFromQuiz = useCallback(() => {
    const answeredCount = currentQ + (selectedAnswer !== null ? 1 : 0);
    if (answeredCount > 0 && currentTopic) {
      const session = {
        id: Date.now(),
        date: new Date().toISOString(),
        topicId: currentTopic.id,
        topicName: currentTopic.name,
        score,
        total: answeredCount,
        wrongSubtopics: wrongAnswers.reduce((acc, wa) => {
          if (wa.subtopic) acc[wa.subtopic] = (acc[wa.subtopic] || 0) + 1;
          return acc;
        }, {}),
        isPartial: true,
      };
      saveSession(userId, session).catch(() => {});
      setHistory((prev) => [session, ...prev].slice(0, 100));
    }
    setScreen('home');
  }, [currentQ, selectedAnswer, currentTopic, score, wrongAnswers, userId]);

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
        isPartial: false,
      };
      // Persist to Supabase (fire-and-forget — don't block the UI)
      saveSession(userId, session).catch(() => {});
      setHistory((prev) => [session, ...prev].slice(0, 100));
      setScreen('result');
    } else {
      setCurrentQ((q) => q + 1);
      setSelectedAnswer(null);
    }
  }, [currentQ, questions, currentTopic, score, wrongAnswers, userId]);

  if (screen === 'username')
    return <UsernameScreen savedUsername={null} onLogin={handleLogin} />;

  if (screen === 'loading-user')
    return (
      <div style={{ ...S.page, ...S.loadingWrap }}>
        <div style={S.spinner} />
        <p style={{ color: '#94a3b8', margin: 0 }}>Loading your progress…</p>
      </div>
    );

  if (screen === 'home')
    return (
      <HomeScreen
        topics={TOPICS}
        onStart={startTopic}
        onProgress={() => setScreen('progress')}
        onSwitchUser={handleSwitchUser}
        history={history}
        username={username}
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
        onHome={handleHomeFromQuiz}
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
