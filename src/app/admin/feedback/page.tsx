import { notFound } from "next/navigation";
import { Suspense } from "react";
import Loader from "~/app/components/customLoading";
import { auth } from "~/server/auth";
import { api, HydrateClient } from "~/trpc/server";
import { DataTable } from "./data-table";

export default async function FeedbackPage() {
  const session = await auth();
  if (!session) {
    return notFound();
  }
  void api.feedback.getFeedbacks.prefetch();
  return (
    <HydrateClient>
      <div className="container mx-auto py-10">
        <Suspense fallback={<Loader text="Loading past orders..." />}>
          <DataTable />
        </Suspense>
      </div>
    </HydrateClient>
  );
}
