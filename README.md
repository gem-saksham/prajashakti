# प्रजाशक्ति — PrajaShakti

**Power of the Citizens**

> यत्र प्रजाशक्तिः तत्र सुशासनम्  
> _"Where there is the power of citizens, there is good governance"_

A civic engagement platform for India. Citizens raise issues, rally support, and hold officials accountable.

## Monorepo Structure

```
prajashakti/
├── apps/
│   ├── api/          ← Fastify backend (Node.js)
│   ├── web/          ← React + Vite (PWA)
│   └── mobile/       ← React Native + Expo (Android/iOS)
├── packages/
│   └── shared/       ← Shared constants, types, utils
├── eslint.config.js  ← ESLint flat config
├── .prettierrc       ← Code formatting
└── .husky/           ← Pre-commit hooks
```

## Quick Start

```bash
# Install all dependencies
npm install

# Run API + Web together
npm run dev

# Or run individually
npm run dev:api      # API on http://localhost:3000
npm run dev:web      # Web on http://localhost:5173
npm run dev:mobile   # Expo dev server
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start API + Web concurrently |
| `npm run dev:api` | Start Fastify API server |
| `npm run dev:web` | Start Vite dev server |
| `npm run dev:mobile` | Start Expo dev server |
| `npm run lint` | Run ESLint |
| `npm run format` | Format with Prettier |
| `npm test` | Run tests across all workspaces |

## Tech Stack

- **API**: Fastify, JWT, Rate Limiting, Helmet
- **Web**: React, Vite, PWA-ready
- **Mobile**: React Native, Expo, React Navigation
- **Shared**: Constants, validation rules, design tokens
- **Quality**: ESLint, Prettier, Husky, lint-staged

## Phase 1 Progress

- [x] Day 1: Monorepo, Fastify API, React web, Expo mobile, linting, hooks
- [ ] Day 2: AWS cloud infrastructure
- [ ] Day 3: CI/CD pipeline
- [ ] Day 4: Database schema
- [ ] Day 5: API Gateway
- [ ] ...

---

_इच्छा → ज्ञान → क्रिया_  
_Desire → Knowledge → Action_
