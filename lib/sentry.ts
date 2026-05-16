// lib/sentry.ts - Sentry error tracking configuration
import * as Sentry from "@sentry/nextjs";

/**
 * Initialize Sentry for error tracking
 * Call this in your server and client layouts
 */
export function initSentry() {
  // Skip initialization if no DSN is provided
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    return;
  }

  Sentry.init({
    // Your Sentry DSN
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

    // Environment
    environment: process.env.NODE_ENV,

    // Release version
    release: process.env.NEXT_PUBLIC_APP_VERSION || "unknown",

    // Performance monitoring sample rate
    tracesSampleRate:
      process.env.NODE_ENV === "production" ? 0.1 : 1.0,

    // Error sample rate
    sampleRate:
      process.env.NODE_ENV === "production" ? 0.8 : 1.0,

    // Ignore noisy browser/plugin errors
    ignoreErrors: [
      // Browser extensions
      "top.GLOBALS",

      // Old browser/plugin bugs
      "originalCreateNotification",
      "canvas.contentDocument",
      "MyApp_RemoveAllHighlights",

      // Browser extensions
      "chrome-extension://",
      "moz-extension://",

      // Common fetch/network issues
      "TypeError: Network request failed",
      "TypeError: Failed to fetch",
      "TypeError: Cannot read properties of undefined (reading 'fetch')",
    ],

    // Breadcrumbs for debugging
    maxBreadcrumbs: 100,

    // Session Replay integration
    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],

    // Replay configuration
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
  });
}

/**
 * Capture an exception manually
 */
export function captureException(
  error: Error,
  context?: Record<string, unknown>
) {
  Sentry.captureException(error, {
    contexts: {
      custom: context,
    },
  });
}

/**
 * Capture a message
 */
export function captureMessage(
  message: string,
  level: "fatal" | "error" | "warning" | "info" | "debug" = "error"
) {
  Sentry.captureMessage(message, level);
}

/**
 * Set user context for error tracking
 */
export function setUserContext(
  userId: string,
  email?: string,
  username?: string
) {
  Sentry.setUser({
    id: userId,
    email,
    username,
  });
}

/**
 * Clear user context
 */
export function clearUserContext() {
  Sentry.setUser(null);
}

/**
 * Add breadcrumb for tracking user actions
 */
export function addBreadcrumb(
  message: string,
  category: string = "user-action",
  level: "fatal" | "error" | "warning" | "info" | "debug" = "info",
  data?: Record<string, unknown>
) {
  Sentry.addBreadcrumb({
    message,
    category,
    level,
    data,
    timestamp: Date.now() / 1000,
  });
}