# Changelog

## [0.10.0] - 2026-04-02

### Added
- add unread message tracking

### Fixed
- cleanup pass — pause hidden animations, fix a11y, dedup sr-only
- improve contrast, add dark mode, clean up miswired CSS

## [0.9.0] - 2026-03-30

### Added
- add `mediaUploadFn` callback prop for consumer-provided file uploads
- `useChat` calls `mediaUploadFn` for each attached file before sending, populating `url`/`media_id` on `SendAttachment`
- new `MediaUploadFn` type exported from `api.ts`

### Changed
- attach button auto-hides when no `mediaUploadFn` is provided (don't show UI that doesn't work)
- `allowAttachments` defaults to `!!mediaUploadFn` instead of `true`

## [0.8.0] - 2026-03-29

### Added
- add cycling loading messages with extensible pool

## [0.7.0] - 2026-03-26

### Added
- standardize canonical diff chat primitives
- add native chat transcript copy support
- add shared client context injection api

### Fixed
- restore list-style on ul/ol inside message bubbles

## [0.6.0] - 2026-03-25

### Added
- add DiffCard component and toolRenderers prop for custom tool rendering

## [0.5.1] - 2026-03-24

### Changed
- add metadata prop to Chat component for client context injection

## [0.5.0] - 2026-03-24

### Added
- v0.4.0 — metadata, onToolCalls, processingSessionId, request dedup
- media support — attachments in messages, image/video rendering, file input
- swap to react-markdown for proper rich content rendering
- built-in markdown rendering for chat messages
- remove adapter pattern, speak chat REST API natively
- implement adapter contract, message model, and component library

### Changed
- Initial commit

### Fixed
- scroll within chat container instead of hijacking page scroll
- extract readable error message from @wordpress/api-fetch error objects
- use npm run build in prepublishOnly (pnpm not available on server)

## 0.4.0

### Added
- `onToolCalls` callback on `useChat` — fires after each turn when tool calls are present, enabling consumers to react to tool executions (apply diffs, invalidate caches, update external state)
- `metadata` option on `useChat` — arbitrary key-value pairs forwarded to the backend with each message for context scoping (e.g. `{ post_id, context: 'editor' }` or `{ selected_pipeline_id }`)
- `sessionContext` option on `useChat` — filters session listing to only show sessions created in a specific context
- `processingSessionId` in `UseChatReturn` — tracks which session initiated the current request, preventing stale loading indicators when switching sessions mid-request
- `context` parameter on `listSessions` API function — optional context filter for session listing
- `metadata` parameter on `sendMessage` API function — forwarded to backend alongside the message
- `X-Request-ID` header on send requests — automatic request deduplication via `crypto.randomUUID()` with fallback
- `headers` field on `FetchOptions` — allows passing custom HTTP headers through the fetch function
- Session creation guard — prevents concurrent session creation with `isCreatingRef`

## 0.2.0

- **BREAKING:** Remove `ChatAdapter` interface and adapter pattern
- Package now speaks the standard chat REST API contract natively
- Add `api.ts` — built-in REST client (`sendMessage`, `continueResponse`, `listSessions`, `loadSession`, `deleteSession`)
- Add `normalizer.ts` — maps raw backend messages to `ChatMessage` format
- Add `types/api.ts` — typed REST request/response shapes
- `useChat` hook now takes `basePath`, `fetchFn`, and `agentId` instead of an adapter
- `Chat` component props updated: `basePath` + `fetchFn` + `agentId` replace `adapter`
- Add `showSessions` prop to `Chat` for optional session switcher
- `showTools` defaults to `true` (was `false`)
- Export API functions and normalizer for advanced use cases
- Remove `ChatCapabilities`, `SendMessageInput`, `SendMessageResult`, `ContinueResult`, `StreamChunk` types

## 0.1.0

- Initial release
- Adapter contract (`ChatAdapter` interface) with capability flags
- Normalized message model (`ChatMessage`, `ChatSession`, `ChatAvailability`)
- Core components: `ChatMessages`, `ChatMessage`, `ChatInput`, `TypingIndicator`, `ToolMessage`, `SessionSwitcher`, `ErrorBoundary`
- `useChat` hook — core state orchestrator with adapter integration
- Base CSS styles
