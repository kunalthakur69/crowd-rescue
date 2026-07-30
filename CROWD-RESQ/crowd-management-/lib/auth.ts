import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-me';
const JWT_EXPIRES_IN = '1d';
const COOKIE_NAME = 'auth-token';

export function generateToken(payload: object): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): any {
  return jwt.verify(token, JWT_SECRET);
}

/** Extract and verify the JWT from the auth-token cookie */
export async function getAuthUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) return null;

  try {
    return verifyToken(token);
  } catch {
    return null;
  }
}

export { COOKIE_NAME };