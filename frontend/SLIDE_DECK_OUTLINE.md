# FloatChat Frontend — Slide Deck Outline

Date: 2025-09-28
Audience: Product + Eng (for PPT creation)

---

## Slide 1 — Title
Title: FloatChat Frontend: What’s Done & What’s Next
Subtitle: Chat + Analytics UI, Tooling, and Roadmap
Footer: Sept 28, 2025

Speaker notes:
- Our focus: stabilize the chat/analytics experience and document a clear path forward.

---

## Slide 2 — The Problem (Before)
- Personas in chat made conversation feel cluttered and inconsistent
- Latest messages were hidden behind the fixed input bar
- SQL tab styling didn’t match analysis panels
- Duplicate/hidden tab panels causing scrollbars and jank
- Heavy render (all tabs mounted) slowed interactions

Speaker notes:
- We targeted issues hurting readability, discoverability, and performance.

---

## Slide 3 — What We Delivered (Overview)
- Clean, persona-free chat with left-aligned bubbles
- Auto-resizing composer; persistent bottom padding via MutationObserver
- “New message” badge re-positioned so replies are never obscured
- Only active tab renders; analysis table scrolls inside Radix ScrollArea
- SQL panel aligned with other panels; tab list wraps (no horizontal scrollbar)
- Type-safe Recharts wrappers; minor hook ordering fixes
- Root README now matches stack and local setup

Speaker notes:
- These changes reduce friction, improve clarity, and make the UI feel stable.

---

## Slide 4 — Chat Experience (Details)
- Persona labels removed; unified left-aligned message style
- Auto-grow textarea composer, no inner scrollbars
- Persistent bottom padding withstands re-renders
- “New messages” indicator floats above the input
- Small polish: trimmed command button label, consistent spacing

Speaker notes:
- Focus on readability and keeping the latest content visible.

---

## Slide 5 — Analytics & Layout (Details)
- Active-tab-only rendering for snappier navigation
- Analysis table wrapped in ScrollArea to avoid page scrollbars
- SQL view styled like the rest; readable, inlined code blocks
- Tab bar wraps on small screens, no overflow scroll
- Mission/viewscreen shells simplified; redundant borders removed

Speaker notes:
- Outcome: consistent, calm dashboard with predictable behavior.

---

## Slide 6 — Stack & Tools
- Core: React 18, TypeScript 5, Vite 5, Tailwind, shadcn/Radix
- Charts: Plotly.js + react-plotly.js; Recharts
- Utilities: lucide-react, clsx, tailwind-merge, class-variance-authority
- Helpers: react-code-blocks (SQL), cmdk (palette)
- Observers: ResizeObserver, MutationObserver
- Dev tooling: ESLint 9, SWC plugin, PostCSS, Autoprefixer

Speaker notes:
- Standard, modern stack; minimal custom code for reliability.

---

## Slide 7 — What Works Now (Demo Checklist)
- Message thread: no personas, clean alignment
- Composer: auto-resizes; bottom padding stays correct
- “New messages” badge: always visible above the input
- Analytics tabs: only active tab renders; analysis table scrolls well
- SQL inspector: aligned styling; readable formatting
- Production build verified (Vite)

Speaker notes:
- Quick live demo: message send, tab switch, SQL view.

---

## Slide 8 — Roadmap (Next)
- Streaming typing indicators and partial-response rendering
- Command palette quick actions + saved prompt templates
- Client-side telemetry; error boundaries for charts
- Skeleton loaders for tab/content transitions
- Accessibility polish (focus, ARIA, keyboard)
- Performance: code-split heavy chart libs; defer non-critical modules

Speaker notes:
- Focus: visibility during compute, resiliency, and startup performance.

---

## Slide 9 — How to Run (Appendix)
- Frontend dev: `npm run dev`
- Frontend prod: `npm run build` → `npm run preview`
- Validate: send a chat → latest reply visible; switch tabs → only active renders; open SQL → consistent style

Speaker notes:
- Include these commands on a backup slide for new contributors.

---

## Slide 10 — Visuals to Capture
- Before/after of chat showing persona removal and visible latest message
- Analysis tab with scrollable table in place
- SQL tab matching panel styling
- Tab bar wrapping (no horizontal scroll)

Speaker notes:
- These screenshots make the improvements obvious in the deck.
