'use client';

import { v4 as uuidv4 } from 'uuid';
import { SESSION_TIMEOUT_MS } from './config';
import { FEATURE_FLAGS } from './feature-flags';

const SESSION_ID_KEY = 'stall_session_id';
const LAST_ACTIVITY_KEY = 'stall_last_activity';
const HAS_POSTED_KEY = 'stall_has_posted';

// Get or create session ID, resetting if inactive too long
export function getSessionId(): string {
  if (typeof window === 'undefined') return '';

  const now = Date.now();
  const lastActivity = parseInt(sessionStorage.getItem(LAST_ACTIVITY_KEY) || '0');
  let sessionId = sessionStorage.getItem(SESSION_ID_KEY);

  // Reset session if inactive for too long or no session exists
  const shouldResetSession = FEATURE_FLAGS.ENABLE_SESSION_TIMEOUT &&
    lastActivity &&
    now - lastActivity > SESSION_TIMEOUT_MS;

  if (!sessionId || shouldResetSession) {
    sessionId = uuidv4();
    sessionStorage.setItem(SESSION_ID_KEY, sessionId);
    sessionStorage.setItem(HAS_POSTED_KEY, 'false');
  }

  // Update last activity
  sessionStorage.setItem(LAST_ACTIVITY_KEY, String(now));

  return sessionId;
}

// Record user activity to keep session alive
export function recordActivity(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
}

// Check if user has already posted this session
export function hasPostedThisSession(): boolean {
  if (typeof window === 'undefined') return false;

  // If session post limit is disabled, always return false
  if (!FEATURE_FLAGS.ENABLE_SESSION_POST_LIMIT) {
    return false;
  }

  // First, check if session should be reset
  getSessionId();

  return sessionStorage.getItem(HAS_POSTED_KEY) === 'true';
}

// Mark that user has posted this session
export function markAsPosted(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(HAS_POSTED_KEY, 'true');
}

// Reset the posted flag (for debug/testing purposes)
export function resetPostedFlag(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(HAS_POSTED_KEY, 'false');
}
