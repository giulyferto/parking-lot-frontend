# CLAUDE.md - parking-lot-frontend

This file orients Claude (or any dev) working in this repo. Read it before
making structural changes.

## What this is

The frontend for the parking lot management platform: a D3-rendered map of
each floor's spots, color-coded by live status, plus the worker check-in/
checkout flow and an admin console (lots, floors, drag-and-drop spot layout,
rate plans, staff accounts). Talks to the `parking-lot-backend` API (JWT
auth, REST + a WebSocket topic per floor) - see that repo's `CLAUDE.md` for
the domain model this UI is built around.

## Stack

- React 19 + TypeScript, Vite 8
- D3 (v7, via the `d3` package) for the floor map
- React Router for client-side routing
- Tailwind CSS v4 (via `@tailwindcss/vite` - no separate PostCSS config)
- Axios for REST calls, `@stomp/stompjs` + `sockjs-client` for the live
  WebSocket feed
- oxlint for linting (not eslint)

## Project structure

```
src/
├── api/            One file per backend resource (client.ts has the shared axios instance)
├── auth/           AuthContext (login/logout/current user) + ProtectedRoute
├── components/
│   ├── FloorMap/   The D3 map + color/style constants, plan-element render
│   │               helpers, geometry math, and the useFloorPlanEditor hook
│   ├── Layout.tsx  Nav shell wrapping every authenticated page
│   └── SpotActionPanel.tsx   Worker check-in/checkout forms
├── pages/          Route-level components (MapPage is the worker home page)
│   └── admin/      Admin-only pages
├── types/          TypeScript types mirroring the backend's DTOs
└── ws/             useFloorSocket - the WebSocket subscription hook
```

## Coordinate model

**Every coordinate stored or drawn is a meter.** `spot.posX/posY/width/
height` and every `FloorElement` geometry coordinate live in one floor-local
Cartesian space with a shared origin (`rotation` stays degrees). `FloorMap`
renders 1 SVG user unit = 1 meter and lets the `viewBox` scale to fit, with
`d3.zoom` layered on top for pan/zoom.

There is no stored scale multiplier - scale is implicit in the numbers.
Calibration is a one-shot bulk rewrite: the editor's ruler tool derives a
`factor` and calls `POST /api/floors/{id}/rescale`, which multiplies every
spot + element coordinate on the floor. The legacy pre-metric spot numbers
were converted once by a backend migration.

Cosmetic strokes (`spot-rect`, grid, boundary, scale bar, edit handles) use
`vector-effect: non-scaling-stroke` so they stay crisp at any lot size or
zoom; text/handle sizes divide a px target by `effectivePxPerMeter`
(`clientWidth / viewBox width * zoomK`). Real-world sizes (lane width,
column radius, grid step) stay in meters and scale.

## The FloorMap component

`components/FloorMap/FloorMap.tsx` is a deliberate "React owns the
container, D3 owns the children" component: React renders a bare `<svg>`
skeleton once (nested `<g>` layers: `viewport` > `grid` / `hit` / `elements`
/ `spots` / `overlay`, plus a non-zoomed `chrome` layer for the scale bar),
and one `useEffect` re-runs D3's enter/update/exit joins whenever the inputs
change. Don't refactor this into "React renders each spot/element as JSX" -
that fights D3's transition/drag/zoom machinery and is exactly the
anti-pattern this structure avoids. The editor's drawing rubber-band, vertex
handles and calibrate ruler are also D3-drawn from props (the `editor` bag),
not React children.

- Each spot is a `<g>` positioned by `translate(posX, posY) rotate(rotation)`
  containing a centered `<rect>` (so rotation happens around the spot's own
  center) and a text label.
- `onSpotClick` is used by the worker map (MapPage) to open the check-in/
  checkout panel.
- `onSpotDragEnd` is only passed by the admin layout editor
  (FloorEditorPage); when present, a `d3.drag()` behavior is attached and
  drag end calls back with the new x/y (meters), which the page persists via
  `PATCH /api/spots/{id}/layout`.
- `d3.zoom` (wheel zoom, drag pan) is always attached. Pan-drag is filtered
  to `select` mode / non-editor so it never hijacks click-to-place; the
  pointer is measured against the `<svg>` so zoom operates in meter space
  and the transform on `g.viewport` stays consistent with `d3.pointer`.

### Floor plan elements

`FloorElement` (see `types/index.ts`, mirrors the backend) is one flexible
list keyed by `kind` - `BOUNDARY` (one polygon per floor, frames the
viewBox; rendered as a solid wall band of real thickness -
`style.widthM`, default `BOUNDARY_WALL_THICKNESS_M` - tracing the ring, so
it *is* the exterior wall, no separate `WALL` needed on the perimeter),
`COLUMN`, `WALL`, `DRIVE_LANE`, `STREET`, `ENTRANCE`, `LABEL` -
each with a GeoJSON-ish `geometry` (`Polygon` / `LineString` / `Point`) and
optional `style`. `components/FloorMap/floorElementStyles.ts` is the single
source of truth for per-kind fill/stroke (same role as `spotColors.ts`).
`components/FloorMap/geometry.ts` holds the pure math (snap, bbox, area,
nice scale-bar length, vertex ops); `floorElements.ts` holds the D3 render
helper + hit-testing; `useFloorPlanEditor.ts` is the tool-mode state machine
the FloorEditorPage feeds in as `editor`. CRUD is `api/floorElements.ts`
(`GET/POST /api/floors/{floorId}/elements`, `PATCH/DELETE
/api/floor-elements/{id}`). The WebSocket carries no geometry - the worker
map only refreshes elements on floor change.

### Spot color mapping

`components/FloorMap/spotColors.ts` is the single source of truth:

| Status | Color | Meaning |
|---|---|---|
| `AVAILABLE` | green | free, ready for check-in |
| `OCCUPIED` | red | a vehicle is checked in |
| `DISABLED` | gray | admin/worker took it out of service |
| `MAINTENANCE` | yellow | temporarily unavailable |

The near-white stroke (`SPOT_STROKE`) is the neutral "empty lot" outline
every spot gets regardless of status. Blue (`SPOT_SELECTED_STROKE`) is
reserved for "selected in the editor" - it's not a status color, so don't
repurpose it as one if a `RESERVED` status gets added later.

## Real-time updates

`ws/useFloorSocket.ts` opens one STOMP-over-SockJS connection per mounted
component and subscribes to `/topic/floors/{floorId}`. `MapPage` uses it to
patch `spots` in place when another worker checks a car in/out, so two
people working the same floor stay in sync without polling. The message
shape (`SpotStatusMessage`) mirrors the backend's `websocket.SpotStatusMessage`
exactly - keep the two in sync if either changes.

## Auth

- JWT stored in `localStorage` (`parking-lot.token`) plus the decoded user
  info (`parking-lot.user`) - see `auth/AuthContext.tsx`. This is a real
  deployed app, not an in-conversation preview, so `localStorage` is the
  right call here (unlike a throwaway HTML artifact).
- `api/client.ts`'s axios interceptor attaches the bearer token to every
  request and clears storage + redirects to `/login` on a 401.
- `auth/ProtectedRoute.tsx` gates routes: plain protection requires any
  logged-in user, `adminOnly` requires `role === 'ADMIN'`.
- There's no self-registration in this UI, matching the backend: the first
  login is the seeded admin account, and every other account (worker or
  admin) is created from the Staff accounts admin page.

## Conventions

- Types live in `src/types/index.ts` as plain union types/interfaces (not
  TS `enum`s - the tsconfig has `erasableSyntaxOnly` on). Anything imported
  from there that's only used as a type must use `import type { ... }` -
  the tsconfig also has `verbatimModuleSyntax` on, so a plain `import`
  of a type-only binding is a build error, not just a lint nit.
- One file per backend resource under `api/`, each exporting typed
  functions (not a class) that call the shared `apiClient`.
- Styling is Tailwind utility classes inline in JSX - no CSS modules, no
  styled-components. Keep it that way for consistency.
- Forms are uncontrolled-enough plain `useState` + `onSubmit` - no form
  library. Introduce one (react-hook-form, etc.) only if forms get
  meaningfully more complex than what's here.
- Don't add code comments by default. Only write one when it captures
  something the code itself can't - a non-obvious constraint, a subtle
  invariant, a workaround for a specific bug, or behavior that would
  surprise a reader. Never comment on *what* the code does (good naming
  already covers that).

## Known simplifications / likely next steps

- The admin layout editor supports drag-to-reposition plus numeric
  width/height/rotation fields, but not interactive resize handles or
  multi-select - fine for placing a few dozen spots by hand, worth
  revisiting if lots get large.
- The plan editor persists on every commit / drag-end with a full `reload()`
  (no optimistic updates), matching the spot editor. Element style edits are
  fire-on-blur. Polygon drawing has no mid-draw vertex dragging - finish the
  shape, then drag its vertices in `select` mode. LABEL text on non-LABEL
  kinds is modelled (`style.label`) but not yet rendered.
- `MapPage` refetches the whole active-sessions list on every WebSocket
  message rather than patching a single session in place - simplest correct
  thing for an MVP-sized active list; swap for a targeted update if that
  list ever gets large.
- The WebSocket handshake isn't authenticated (matches the backend's
  current state - see that repo's CLAUDE.md).
- No tests yet. If adding some, Vitest + React Testing Library is the
  natural fit for this stack (already using Vite).
- Three oxlint warnings are accepted as-is: `AuthContext.tsx` exporting both
  the provider and the `useAuth` hook (standard React context pattern,
  harmless beyond a Fast Refresh nicety), and two `setState`-in-effect notes -
  `MapPage` for the floor-change reset and `useSpotRowTool` for the
  tool-change reset (both clear stale draft state when a prop flips).

## Running locally

```bash
npm install
cp .env.example .env.local   # only if the backend isn't on localhost:8080
npm run dev
```

Full detail in `README.md`. This scaffold has already been through a clean
`npm run build` (`tsc -b && vite build`) and `npm run lint` - if you hit a
type error after changing something, that's a real regression to fix, not a
pre-existing issue to route around.
