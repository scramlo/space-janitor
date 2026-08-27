# Space Janitor

A humorous 3D space-cleanup game built with the PlayCanvas Engine. You are a professional Custodial Specialist. The galaxy is not impressed. Your cat needs surgery.

## MVP

One replayable job — Docking Bay 7 — with money, employment standing, a thruster upgrade, and a surgery-fund victory.

### Controls

- **W A S D** — thrust
- **Arrow keys** — look (yaw / pitch, ship stays upright)
- **Space / Enter** — confirm screens

### Loop

1. Read the work order
2. Collect every piece of debris before the deadline
3. Collect pay, take penalties, optionally buy thrusters
4. Repeat until the surgery fund is complete — or you are terminated

## Prerequisites

Node.js 22.23.2 or later.

## Getting started

```bash
npm install
npm run dev
```

Open <http://localhost:5173>.

Configurable values (surgery cost, pay, deadlines, upgrades, employment) live in `src/config/`.

## Scripts

| Command             | Description                       |
| ------------------- | --------------------------------- |
| `npm run dev`       | Start the Vite development server |
| `npm run build`     | Build for production              |
| `npm run start`     | Preview the production build      |
| `npm run lint`      | Run ESLint                        |
| `npm run fmt`       | Check formatting                  |
| `npm run typecheck` | Run TypeScript checks             |
