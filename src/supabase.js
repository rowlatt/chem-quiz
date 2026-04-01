import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

/**
 * Find an existing user by username, or create one.
 * Usernames are stored lowercase.
 */
export async function loginOrCreateUser(rawUsername) {
  const username = rawUsername.trim().toLowerCase();

  const { data: existing } = await supabase
    .from('users')
    .select('id, username')
    .eq('username', username)
    .maybeSingle();

  if (existing) return existing;

  const { data: created, error } = await supabase
    .from('users')
    .insert({ username })
    .select('id, username')
    .single();

  if (error) throw new Error(error.message);
  return created;
}

/**
 * Fetch all quiz sessions for a user, newest first.
 * Returns them normalised to the shape the rest of the app expects.
 */
export async function fetchSessions(userId) {
  const { data, error } = await supabase
    .from('quiz_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);

  return (data || []).map((row) => ({
    id: row.id,
    date: row.created_at,
    topicId: row.topic_id,
    topicName: row.topic_name,
    score: row.score,
    total: row.total,
    wrongSubtopics: row.wrong_subtopics || {},
    isPartial: row.is_partial || false,
  }));
}

/**
 * Persist a completed quiz session to Supabase.
 */
export async function saveSession(userId, session) {
  const { error } = await supabase.from('quiz_sessions').insert({
    user_id: userId,
    topic_id: session.topicId,
    topic_name: session.topicName,
    score: session.score,
    total: session.total,
    wrong_subtopics: session.wrongSubtopics,
    is_partial: session.isPartial ?? false,
  });

  if (error) throw new Error(error.message);
}
