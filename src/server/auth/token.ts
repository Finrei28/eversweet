import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET!; // Make sure this is defined securely in env

export interface TokenPayload {
  userId: string;
  email: string;
  firstName: string;
  role: string;
  // add other fields you store in the token
}

export function verifyToken(token: string): TokenPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded as TokenPayload;
  } catch (err) {
    throw new Error("Invalid or expired token");
  }
}
