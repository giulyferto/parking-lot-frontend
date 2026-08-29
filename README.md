# parking-lot-frontend

React + TypeScript + D3 frontend for the parking lot management platform.
Renders each floor as a color-coded map, lets facility workers check
vehicles in/out, and gives admins a drag-and-drop layout editor plus
lot/floor/rate-plan/staff-account management.

See `CLAUDE.md` for the full architecture.

## Prerequisites

- Node 20+
- The backend (`parking-lot-backend`) running locally on :8080 with at least
  one seeded admin account (see that repo's README)

## First run

```bash
npm install
cp .env.example .env.local   # only needed if the backend isn't on :8080
npm run dev
```

Open http://localhost:5173 and log in with the admin account seeded by the
backend. Create a parking lot, a floor, some spots (drag them into place),
and a rate plan before trying the worker check-in flow on the Map page.

## Scripts

- `npm run dev` - dev server with HMR
- `npm run build` - type-check (`tsc -b`) then production build to `dist/`
- `npm run lint` - oxlint
- `npm run preview` - serve the production build locally

This scaffold has already been through a clean `npm run build` and
`npm run lint` in the environment it was generated in, so the toolchain and
types are known-good as of this commit.
