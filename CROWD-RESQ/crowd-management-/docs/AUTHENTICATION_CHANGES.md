# Authentication Flow Changes — Documentation

## Overview

The authentication system has been completely rewritten to replace **localStorage-based auth** with a secure **MongoDB + JWT + HTTP-only cookie** based authentication flow with **role-based access control**.

---

## What Changed

### 1. `.env` (NEW)
- Created `.env` file at project root with:
  - `DB_URL` — MongoDB connection string
  - `JWT_SECRET` — Secret key for signing JWT tokens
- **Action required**: Update `DB_URL` to your actual MongoDB URI (Atlas or local).

### 2. `lib/models/User.ts` (MODIFIED)
- **Added** `pre('save')` hook that automatically hashes passwords using `bcrypt` before saving to MongoDB.
- **Added** `securityGuard` to the role enum (was `security` — now `student | securityGuard | ambulance`).
- **Added** `comparePassword` method to the interface for proper TypeScript typing.
- Passwords are **never stored in plain text** anymore.

### 3. `lib/auth.ts` (REWRITTEN)
- **Removed** hardcoded JWT secret (`"hello world"`); now reads from `process.env.JWT_SECRET`.
- **Replaced** `require('jsonwebtoken')` with proper ES module `import`.
- **Added** `getAuthUser()` — reads and verifies JWT from the `auth-token` HTTP-only cookie using Next.js `cookies()`.
- **Added** `COOKIE_NAME` export for consistent cookie naming.
- **Removed** the old `authenticate()` function that read from `Authorization` header.

### 4. `app/api/auth/signup/route.ts` (MODIFIED)
- **Added** input validation (all fields required, valid role check).
- Password is hashed automatically by the User model's `pre('save')` hook — no manual hashing in the route.
- **Removed** commented-out token generation code.
- Returns clean `{ message, user }` response.

### 5. `app/api/auth/signin/route.ts` (REWRITTEN)
- On successful login, **sets an HTTP-only cookie** (`auth-token`) containing the JWT.
- Cookie config: `httpOnly: true`, `secure` in production, `sameSite: 'lax'`, 1-day expiry.
- **No longer returns the token in the response body** (token lives only in the cookie).
- Returns `{ message, user: { id, name, email, role } }`.

### 6. `app/api/auth/me/route.ts` (NEW)
- **GET** endpoint that reads the `auth-token` cookie, verifies the JWT, and returns the current user's data.
- Used by dashboard pages to verify authentication and get user role.
- Returns `401` if not authenticated.

### 7. `app/api/auth/logout/route.ts` (NEW)
- **POST** endpoint that clears the `auth-token` cookie (sets `maxAge: 0`).
- Called by the logout button on all dashboard pages.

### 8. `app/signin/page.tsx` (REWRITTEN)
- **Removed** all localStorage logic.
- Now calls `POST /api/auth/signin` with email and password.
- On success, redirects to `/dashboard/{role}` based on the API response.
- **Added** loading state and error message display.
- Restored the video background layout (was using the plain layout before).

### 9. `app/signup/page.tsx` (MODIFIED)
- **Removed** `localStorage.setItem("user", ...)`.
- Now calls `POST /api/auth/signup` with name, email, password, and role.
- On success, redirects to `/signin`.
- **Added** loading state and error message display.
- Removed all commented-out code.

### 10. `app/dashboard/student/page.tsx` (MODIFIED)
- **Replaced** `localStorage.getItem("user")` with `fetch('/api/auth/me')`.
- Verifies the user's role is `student`; redirects to `/signin` otherwise.
- **Logout** now calls `POST /api/auth/logout` to clear the cookie.

### 11. `app/dashboard/teacher/page.tsx` (MODIFIED)
- Same changes as student dashboard but checks for `teacher` role.
- **Logout** now calls `POST /api/auth/logout`.

### 12. `app/dashboard/ambulance/page.tsx` (MODIFIED)
- Same changes as student dashboard but checks for `ambulance` role.
- **Logout** now calls `POST /api/auth/logout`.

### 13. `middleware.ts` (NEW)
- Next.js Edge Middleware for **server-side route protection**.
- **Protected routes** (`/dashboard/*`):
  - Redirects unauthenticated users to `/signin`.
  - Decodes the JWT from the cookie to check the user's role.
  - If a user tries to access a dashboard that doesn't match their role, they are redirected to their correct dashboard.
- **Auth pages** (`/signin`, `/signup`):
  - If an authenticated user visits these pages, they are redirected to their dashboard.
- Matcher: `['/dashboard/:path*', '/signin', '/signup']`

---

## Authentication Flow

### Signup
1. User fills out the form (name, email, password, role).
2. Frontend calls `POST /api/auth/signup`.
3. Backend validates input, checks for duplicates, saves user (password auto-hashed).
4. User is redirected to `/signin`.

### Signin
1. User enters email and password.
2. Frontend calls `POST /api/auth/signin`.
3. Backend finds user in MongoDB, compares password with bcrypt.
4. On success, generates a JWT containing `{ id, email, role, name }`.
5. JWT is set as an HTTP-only cookie (`auth-token`).
6. Frontend redirects to `/dashboard/{role}`.

### Dashboard Access
1. Middleware checks for `auth-token` cookie on every `/dashboard/*` request.
2. If no token → redirect to `/signin`.
3. If token exists → decode role → verify user is on the correct dashboard.
4. Dashboard page also calls `GET /api/auth/me` to get user data for display.

### Logout
1. User clicks logout.
2. Frontend calls `POST /api/auth/logout`.
3. Backend clears the `auth-token` cookie.
4. Frontend redirects to `/signin`.

---

## Role Mapping

| Role        | Dashboard URL            | UI Label           |
|-------------|-------------------------|--------------------|
| `student`   | `/dashboard/student`    | Student            |
| `securityGuard`   | `/dashboard/securiyGuard`    | Security Guard     |
| `ambulance` | `/dashboard/ambulance`  | Ambulance Service  |

---

## Security Improvements

| Before (localStorage)                  | After (MongoDB + Cookies)                        |
|----------------------------------------|--------------------------------------------------|
| Passwords stored in plain text         | Passwords hashed with bcrypt (salt rounds: 10)   |
| Token/user data in localStorage (XSS)  | JWT in HTTP-only cookie (not accessible via JS)  |
| No server-side route protection        | Next.js middleware validates token on every request |
| Hardcoded JWT secret                   | JWT secret from environment variable             |
| Client-side only role check            | Server-side role validation in middleware + API   |

---

## Environment Variables Required

```env
DB_URL=mongodb://localhost:27017/crowd-resq     # or your MongoDB Atlas URI
JWT_SECRET=your-super-secret-jwt-key            # change this in production!
```

---

## Dependencies Added

- `@types/jsonwebtoken` (dev) — TypeScript types for JWT library
