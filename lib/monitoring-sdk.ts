// Loaded on demand by lib/monitoring.ts. Importing only init here (instead of the whole
// package from a dynamic import) lets the bundler leave out replay, feedback and tracing.
export { init } from '@sentry/browser'
