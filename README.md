# Oracle Sales App — Mobile

A field app for sales agents to create client records and log client meetings — the mobile companion to [OracleSalesApp-Web](https://github.com/Cedie99/OracleSalesApp-Web).

> **Status:** Scaffolded — project structure is in place. Clone, install, add `.env.local`, and run the dev build. See [Local Setup](#local-setup) below.

---

## Tech Stack

| Layer | Technology |
| ----- | ---------- |
| Framework | Expo (React Native), file-based routing via `expo-router` |
| Language | TypeScript 5 |
| UI Kit | Tamagui |
| Backend & Auth | Supabase |
| JS Engine | Hermes |
| Build & Distribution | EAS Build / EAS Submit |

**Web Admin reference stack** (OracleSalesApp-Web): Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · shadcn/ui · Supabase · TanStack Table v8 · Recharts v3 · xlsx export

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- [npm](https://www.npmjs.com/) (included with Node.js)
- Git
- [Android Studio](https://developer.android.com/studio) (for local builds and emulator)
  - During install, make sure **Android SDK**, **Android SDK Platform**, and **Android Virtual Device** are checked
  - After install, open Android Studio → SDK Manager → install **Android 14 (API 34)** or later

---

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

A `.env.local.example` file is included in the repo. Copy it and fill in the values:

```bash
cp .env.local.example .env.local
```

```
EXPO_PUBLIC_SUPABASE_URL=       # Get this from the Supabase dashboard → Project Settings → API
EXPO_PUBLIC_SUPABASE_ANON_KEY=  # Same page — use the anon/public key, NOT the service_role key
```

**Where to get the keys:**
- Go to [supabase.com](https://supabase.com) → open the project → **Project Settings → API**
- Copy `Project URL` and `anon public` key
- If you don't have access to the Supabase project, ask **Vince Carter** (project lead)

> **Never commit `.env.local`** — it is already in `.gitignore`.

### 4. Set Up Android Environment Variables

Android Studio needs to be on your PATH. Add these to your system environment variables:

**Windows:**
```
ANDROID_HOME = C:\Users\<your-username>\AppData\Local\Android\Sdk
PATH += %ANDROID_HOME%\tools
PATH += %ANDROID_HOME%\tools\bin
PATH += %ANDROID_HOME%\platform-tools
```

Verify it works:
```bash
adb --version
```

### 5. Run on a Physical Device or Emulator

**Option A — Physical Android device:**
1. On your phone: Settings → Developer Options → enable **USB Debugging**
2. Plug in via USB
3. Run:
```bash
npx expo run:android
```

**Option B — Android Emulator:**
1. Open Android Studio → **Device Manager** → create a virtual device (Pixel 6, API 34 recommended)
2. Start the emulator
3. Run:
```bash
npx expo run:android
```

> **Note:** This builds the app locally using Android Studio — no EAS cloud credits needed. Camera works on a physical device; GPS works on both physical and emulator (emulator uses simulated location).

### 6. Start the Development Server

Once the app is installed on your device/emulator, you can start the server and it will auto-reload on code changes:

```bash
npx expo start
```

---

## Available Scripts

| Command | Description |
| ------- | ----------- |
| `npx expo start` | Start the development server (hot reload) |
| `npx expo run:android` | Build and run locally on device or emulator (requires Android Studio) |
| `npm run lint` | Run ESLint |
| `npm run build:preview:android` | EAS cloud preview build (shareable APK for team testing) |
| `npm run build:prod:android` | EAS cloud production build (AAB, for Play Store) |
| `npm run build:prod:apk` | EAS cloud production build (APK, for direct install) |

---

## Project Structure

```
OracleSalesApp-Mobile/
├── app/
│   ├── _layout.tsx              # Root layout: TamaguiProvider + auth gate
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   └── login.tsx            # Email/password sign-in via Supabase
│   └── (tabs)/
│       ├── _layout.tsx          # Tab bar (Clients, Meetings)
│       ├── clients/
│       │   ├── index.tsx        # Client list (role-scoped via Supabase RLS)
│       │   ├── create.tsx       # Create client + duplicate company-name check
│       │   └── [id].tsx         # Client detail + "Record Meeting" shortcut
│       └── meetings/
│           ├── index.tsx        # Meeting history list
│           └── record.tsx       # Meeting form: GPS + selfie + agenda + outcome
├── lib/
│   ├── supabase.ts              # Supabase client (SecureStore adapter)
│   ├── useAuth.ts               # Session hook + signOut
│   ├── useClients.ts            # Fetch/refresh clients
│   └── useMeetings.ts           # Fetch/refresh meetings
├── types/
│   ├── index.ts                 # Client, Meeting, UserProfile types + enums
│   └── database.ts              # Supabase DB type stubs (replace with generated types)
├── assets/                      # Images, icons, fonts
├── app.json                     # Expo config (scheme, permissions, EAS project)
├── babel.config.js              # Tamagui babel plugin
├── eas.json                     # EAS build profiles
├── tamagui.config.ts            # Tamagui theme config
├── tsconfig.json                # TypeScript config + @/* path alias
├── .env.local                   # Your local env vars — DO NOT COMMIT
└── .env.local.example           # Template — copy this to .env.local
```

---

## Git Workflow

This project follows **GitHub Flow** — branch off `main`, open a PR, get one review, squash-merge.

### Rules

1. **`main` is always deployable.** Never push directly to it.
2. **One branch per task.** Always branch off `main`.
3. **Keep branches short-lived.** Aim to merge within 1–3 days.
4. **All merges go through a Pull Request.** At least one teammate must review before merging.
5. **Delete the branch after it is merged.**

### Branch Naming

| Type | Format | Example |
| ---- | ------ | ------- |
| Feature | `feature/<short-description>` | `feature/record-meeting-form` |
| Bug fix | `fix/<short-description>` | `fix/gps-capture-crash` |
| Chore / config | `chore/<short-description>` | `chore/update-expo-sdk` |

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

# 5. After approval, squash-merge to main, then delete the branch
```

### Commit Message Format

| Prefix | When to use |
| ------ | ----------- |
| `feat:` | New feature |
| `fix:` | Bug fix |
| `chore:` | Config, deps, tooling |
| `refactor:` | Code change with no behavior change |
| `style:` | UI or styling only |

**Examples:**

```
feat: add selfie capture to meeting form
fix: correct GPS permission handling on Android 13
chore: upgrade Expo SDK to 52
refactor: extract client search into shared hook
```

### Pull Request Checklist

Before requesting a review:

- [ ] Branch is up to date with `main` (`git pull origin main`)
- [ ] `npm run lint` passes with no warnings
- [ ] Feature works on a physical device or emulator
- [ ] No `.env.local` or secrets are committed

---

## Related Repositories

| Repo | Description |
| ---- | ----------- |
| [OracleSalesApp-Web](https://github.com/Cedie99/OracleSalesApp-Web) | Web admin dashboard (Next.js 16 + Supabase) — reference implementation |
| [Old-AgentOps-Mobile](https://github.com/VinceCarter12/Old-AgentOps-Mobile) | Previous mobile app — reference for tech stack patterns, not a fork |

---

## Team

| Name | Role | Who to ask |
| ---- | ---- | ---------- |
| Vince Carter | Project Lead | Supabase credentials, EAS project access, repo permissions |
| Jhon Cedrick Ignacio | Developer | — |
| Archie Delacruz | Developer | — |
| Guanez | Developer | — |

**Having trouble getting started?** Contact **Vince Carter** for:
- Supabase project access (URL + anon key)
- EAS project ID
- GitHub repo collaborator invite
