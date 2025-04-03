// types/next-auth.d.ts

import { Role } from "@prisma/client";
import NextAuth, {
  DefaultJWT,
  DefaultSession,
  User as DefaultUser,
  Default,
} from "next-auth";
import { AdapterUser } from "@auth/core/adapters";
import { JWT as DefaultJWTType } from "next-auth/jwt";

declare module "@auth/core/adapters" {
  interface AdapterUser {
    role: Role; // Add the role property here
  }
}

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      email: string;
      requires2FAExpiresAt?: Date | string | null;
    } & DefaultSession;
  }

  interface User extends DefaultUser {
    role: Role;
    requires2FAExpiresAt?: Date | string | null;
  }

  interface SignInResponse extends DefaultSignInResponse {
    user: User;
    requires2FAExpiresAt?: Date | string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string;
    role: Role;
    email: string;
    requires2FAExpiresAt?: Date | string | null;
  }
}
