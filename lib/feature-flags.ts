/**
 * Feature flags for controlling experimental or toggleable features
 */

export const FEATURE_FLAGS = {
  // Session timeout: Resets session after inactivity
  ENABLE_SESSION_TIMEOUT: false,

  // Rate limiting: Limits posts per hour per IP
  ENABLE_RATE_LIMITING: false,

  // Session-based post limit: Only one post per session
  ENABLE_SESSION_POST_LIMIT: false,
} as const;
