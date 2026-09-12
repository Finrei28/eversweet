// types/next-auth.d.ts

import { Role } from "@prisma/client";
import NextAuth, {
  DefaultJWT,
  DefaultSession,
  User as DefaultUser,
  Default,
} from "next-auth";
import { JWT as DefaultJWTType } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    // Intersected with DefaultSession["user"], not DefaultSession: the latter is the
    // whole session object, so it made `expires` a required field of the *user* and
    // put a nested `user.user` on the type. Nothing ever read either.
    user: {
      id: string;
      role: Role;
      email: string;
      requires2FAExpiresAt?: Date | string | null;
    } & DefaultSession["user"];
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
