# CrowdResQ — Project Structure & Functionality

## Tech Stack

Next.js 15 | React 18 | TypeScript | MongoDB (Mongoose) | JWT (HTTP-only cookies) | Tailwind CSS | shadcn/ui

---

## File Structure

```
crowd-management-/
├── .env                          # DB_URL, JWT_SECRET
├── middleware.ts                  # Route protection & role-based redirects
├── app/
│   ├── layout.tsx                # Root layout (ThemeProvider, Inter font)
│   ├── page.tsx                  # Landing page (Sign In / Sign Up links)
│   ├── globals.css               # Global styles
│   ├── signin/page.tsx           # Sign-in form (calls API, cookie-based)
│   ├── signup/page.tsx           # Sign-up form (role selection, calls API)
│   ├── api/auth/
│   │   ├── signup/route.ts       # POST — register user in MongoDB
│   │   ├── signin/route.ts       # POST — authenticate & set JWT cookie
│   │   ├── me/route.ts           # GET  — return current user from cookie
│   │   └── logout/route.ts       # POST — clear auth cookie
│   └── dashboard/
│       ├── student/page.tsx      # Student dashboard (alerts, messaging)
│       ├── SecurityGuard/page.tsx# Security Guard dashboard (video feed, alerts)
│       └── ambulance/page.tsx    # Ambulance dashboard (dispatch, video feed)
├── lib/
│   ├── db.ts                     # MongoDB connection (Mongoose)
│   ├── auth.ts                   # JWT generate/verify, cookie helpers
│   ├── utils.ts                  # cn() utility (tailwind-merge + clsx)
│   └── models/
│       └── User.ts               # User schema (name, email, password, role)
├── components/
│   ├── theme-provider.tsx        # next-themes provider
│   └── ui/                       # shadcn/ui components (button, card, etc.)
├── hooks/
│   ├── use-mobile.tsx            # Mobile breakpoint hook
│   └── use-toast.ts              # Toast notification hook
└── public/videos/                # Background & dashboard video assets
```

---

## Roles

| Role              | Value in DB     | Dashboard URL              |
| ----------------- | --------------- | -------------------------- |
| Student           | `student`       | `/dashboard/student`       |
| Security Guard    | `SecurityGuard` | `/dashboard/SecurityGuard` |
| Ambulance Service | `ambulance`     | `/dashboard/ambulance`     |

---

## Auth Flow (Summary)

1. **Signup** → `POST /api/auth/signup` → saves user to MongoDB (password auto-hashed via bcrypt pre-save hook)
2. **Signin** → `POST /api/auth/signin` → verifies credentials → sets `auth-token` HTTP-only cookie (JWT)
3. **Middleware** → decodes JWT from cookie → blocks unauthorized access → enforces role-based routing
4. **Dashboard** → calls `GET /api/auth/me` → gets user data from cookie → renders role-specific UI
5. **Logout** → `POST /api/auth/logout` → clears cookie → redirects to `/signin`

---

## Key Files & What They Do

| File                      | Purpose                                                                                                              |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `.env`                    | MongoDB URI (`DB_URL`) and JWT secret (`JWT_SECRET`)                                                                 |
| `middleware.ts`           | Edge middleware — protects `/dashboard/*`, redirects wrong roles, redirects authenticated users away from auth pages |
| `lib/db.ts`               | Connects to MongoDB using Mongoose                                                                                   |
| `lib/auth.ts`             | `generateToken()`, `verifyToken()`, `getAuthUser()` (reads cookie), exports `COOKIE_NAME`                            |
| `lib/models/User.ts`      | Mongoose schema with `pre('save')` bcrypt hook and `comparePassword()` method                                        |
| `api/auth/signup`         | Validates input, checks duplicates, creates user                                                                     |
| `api/auth/signin`         | Finds user, compares password, issues JWT cookie                                                                     |
| `api/auth/me`             | Returns decoded user from cookie (used by dashboards)                                                                |
| `api/auth/logout`         | Clears the `auth-token` cookie                                                                                       |
| `signin/page.tsx`         | Login form → calls signin API → redirects to role dashboard                                                          |
| `signup/page.tsx`         | Registration form with role picker → calls signup API → redirects to signin                                          |
| `dashboard/student`       | Emergency alert button, messaging, notifications                                                                     |
| `dashboard/SecurityGuard` | Video feed (2 cameras), security & medical emergency buttons, messaging                                              |
| `dashboard/ambulance`     | Video feed, dispatch response button, emergency notifications                                                        |
