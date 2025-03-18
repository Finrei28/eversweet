import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { type NextAuthConfig } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "~/server/db";
import bcrypt from "bcryptjs";

export const authConfig = {
  providers: [
    CredentialsProvider({
      name: "Credentials",

      credentials: {
        username: { label: "Username", type: "text", placeholder: "Finlay" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (
          !credentials ||
          typeof credentials.username !== "string" ||
          typeof credentials.password !== "string"
        ) {
          return null;
        }

        const user = await db.user.findUnique({
          where: {
            username: credentials.username,
          },
          select: {
            id: true,
            email: true,
            role: true,
            password: true, // Needed for password comparison
            requires2FAExpiresAt: true, // Needed for 2FA expiration
          },
        });

        // If no error and we have user data, return it
        if (
          user &&
          user.password &&
          bcrypt.compareSync(credentials.password, user.password)
        ) {
          return {
            ...user,
            requires2FAExpiresAt: user.requires2FAExpiresAt
              ? user.requires2FAExpiresAt.toISOString()
              : null,
          };
        }
        // Return null if user data could not be retrieved
        return null;
      },
    }),
  ],
  adapter: PrismaAdapter(db),
  session: {
    strategy: "jwt",
    maxAge: 12 * 60 * 60, // 12 hours
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // If the user is required to do 2FA and it's not expired, do not set user data in the token yet
        // if (
        //   !user.requires2FAExpiresAt ||
        //   new Date(user.requires2FAExpiresAt) < new Date()
        // ) {
        //   return token; // Don't return any user data in the token
        // }

        // If no 2FA or expired 2FA, set user data in the token
        token.role = user.role;
        token.email = user.email as string;
        token.id = user.id as string;
        token.requires2FAExpiresAt = user.requires2FAExpiresAt;
      }
      return token;
    },
    async session({ session, token }) {
      // if (
      //   !token.requires2FAExpiresAt ||
      //   new Date(token.requires2FAExpiresAt) < new Date()
      // ) {
      //   return session;
      // }

      if (session?.user) {
        session.user.role = token.role;
        session.user.id = token.id;
        session.user.email = token.email;
        session.user.requires2FAExpiresAt = token.requires2FAExpiresAt;
      }

      return session;
    },
    async redirect({ url, baseUrl }) {
      return `${baseUrl}/admin`;
    },
  },
  secret: process.env.AUTH_SECRET, // AUTH_SECRET in .env file
} satisfies NextAuthConfig;
