import MaxWidthWapper from "~/app/components/maxWidthWrapper";
import { api, HydrateClient } from "~/trpc/server";
import MenuCards from "./_components/menu-cards";

export default function MenuPage() {
  return (
    <HydrateClient>
      <MaxWidthWapper>
        <div className="py-10">
          <MenuCards />
        </div>
      </MaxWidthWapper>
    </HydrateClient>
  );
}
