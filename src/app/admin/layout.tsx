import { notFound } from "next/navigation";

import { auth } from "~/server/auth";
import { AdminNavbar } from "./_components/adminNavbar";

/**
 * Gates every admin route before anything is sent.
 *
 * The pages still check for themselves, and must: a navigation between admin pages
 * renders only the page, never this layout again. But each page now sits behind its
 * route's loading.tsx, which the response starts streaming - status 200 and all - before
 * the page runs. A signed-out visitor was answered 200 with a 404 painted in afterwards,
 * where it used to be a 404. Checking here, above those boundaries, keeps it one.
 *
 * `auth()` is wrapped in React's `cache`, so the page's own check costs nothing more.
 */
export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  if (!session?.user) {
    return notFound();
  }

  return <AdminNavbar>{children}</AdminNavbar>;
}
