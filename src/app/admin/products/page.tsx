import MaxWidthWapper from "~/app/components/maxWidthWrapper";
import { formatCurrency } from "~/lib/formatters";
import Image from "next/image";
import ProductDialogContext from "./_components/productDialogContext";
import { CheckCircle2, XCircle } from "lucide-react";
import { db } from "~/server/db";
import { ProductCards } from "./_components/productCards";
import { EditCustomisation } from "./_components/editCustomisation";
import { auth } from "~/server/auth";
import { redirect } from "next/navigation";
import { api } from "~/trpc/server";

export default async function ProductsPage() {
  void api.dessert.getProducts.prefetch();
  const session = await auth();

  if (!session?.user) {
    redirect("/");
  }
  return (
    <MaxWidthWapper>
      {/* Search functionality */}
      <div className="mb-10 flex justify-end gap-6">
        <EditCustomisation />
        <ProductDialogContext />
      </div>

      <div className="mb-4 flex justify-center">
        <ProductCards />
      </div>
    </MaxWidthWapper>
  );
}
