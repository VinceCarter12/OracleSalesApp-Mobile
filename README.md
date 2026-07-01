# Oracle Sales App — Mobile

A field app for sales agents to create clients and log client meetings — the mobile companion to [OracleSalesApp-Web](https://github.com/Cedie99/OracleSalesApp-Web).

This README is a **setup guide only** — it describes how the team should scaffold and configure the mobile project. It reuses the tech stack from the team's previous mobile app ([Old-AgentOps-Mobile](https://github.com/VinceCarter12/Old-AgentOps-Mobile)) as a starting point, but is a fresh build scoped to the Sales Client Meeting App PRD, not a fork of the old codebase.

## Tech Stack

| Layer                | Technology                                                 |
| --------------------- | ----------------------------------------------------------- |
| Framework             | Expo (React Native), file-based routing via `expo-router`   |
| Language              | TypeScript 5                                                 |
| UI Kit                | Tamagui                                                       |
| Backend & Auth        | Supabase                                                     |
| JS Engine             | Hermes                                                        |
| Build & Distribution  | EAS Build / EAS Submit                                       |

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- [npm](https://www.npmjs.com/) (included with Node.js)
- Git
- An [Expo account](https://expo.dev/signup)
- `eas-cli` (installed in setup below)

## Local Setup

### 1. Clone the Repository

```bash
git clone https://github.com/VinceCarter12/OracleSalesApp-Mobile.git
cd OracleSalesApp-Mobile
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env.local` file in the project root and ask the project lead for the values:

```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

### 4. Start the Development Server

```bash
npx expo start
```

Open the app in a development build, Android emulator, iOS simulator, or Expo Go.

## Available Scripts

| Command                          | Description                                       |
| ---------------------------------- | --------------------------------------------------- |
| `npx expo start`                  | Start the development server                        |
| `npm run android` / `npm run ios` | Run on a connected device or emulator               |
| `npm run lint`                    | Run ESLint                                          |
| `npm run build:dev:android`       | EAS development build (debug tools included)        |
| `npm run build:preview:android`   | EAS preview build (for internal team testing)        |
| `npm run build:prod:android`      | EAS production build (AAB, for Play Store)           |
| `npm run build:prod:apk`          | EAS production build (APK, for direct install)       |

## Git Workflow

This project follows **GitHub Flow** — a lightweight branch-based workflow suited for a small team with continuous deployment.

### Core Rules

1. **`main` is always deployable.** Never push directly to it.
2. **One branch per task or feature.** Always branch off `main`.
3. **Keep branches short-lived.** Aim to merge within 1–3 days to avoid drift.
4. **All merges go through a Pull Request.** At least one teammate must review before merging.
5. **Delete the branch after it is merged.**

### Branch Naming

| Type           | Format                        | Example                     |
| -------------- | ----------------------------- | ---------------------------- |
| Feature        | `feature/<short-description>` | `feature/meeting-gps-capture` |
| Bug fix        | `fix/<short-description>`     | `fix/photo-capture-crash`     |
| Chore / config | `chore/<short-description>`   | `chore/update-expo-sdk`       |

### Day-to-Day Flow

```bash
# 1. Start from an up-to-date main
git checkout main
git pull origin main

# 2. Create your branch
git checkout -b feature/your-feature

# 3. Work and commit often
git add <files>
git commit -m "feat: add GPS capture to meeting form"

# 4. Push and open a Pull Request
git push origin feature/your-feature
# → open PR on GitHub, assign at least 1 reviewer

# 5. After approval, merge to main (squash merge recommended)
# → delete the branch
```

### Commit Message Format

| Prefix      | When to use                         |
| ----------- | ------------------------------------ |
| `feat:`     | New feature                          |
| `fix:`      | Bug fix                              |
| `chore:`    | Config, deps, tooling                |
| `refactor:` | Code change with no behavior change  |
| `style:`    | UI or CSS only                       |

**Examples:**

```
feat: add GPS capture to meeting form
fix: correct photo capture crash on Android 13
chore: upgrade Expo SDK
refactor: extract client form into shared component
```

### Pull Request Checklist

Before requesting a review, make sure:

- [ ] The branch is up to date with `main` (`git pull origin main`)
- [ ] `npm run lint` passes with no warnings
- [ ] The feature works as expected on a device or emulator
- [ ] No `.env.local` or secrets are committed
