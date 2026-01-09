import { getSessionId } from './session';

// Client-side analytics tracking helper
export async function trackEvent(
  eventType: string,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    const sessionId = getSessionId();

    await fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        eventType,
        metadata,
      }),
    });
  } catch (error) {
    // Silently fail - don't disrupt user experience if analytics fails
    console.error('Analytics tracking failed:', error);
  }
}
