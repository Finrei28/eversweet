import MaxWidthWapper from "~/app/components/maxWidthWrapper";
import { HydrateClient } from "~/trpc/server";
import MenuCards from "./_components/menu-cards";
import ServerComponent from "./_components/serverComponent";

export default function MenuPage() {
  return (
    <HydrateClient>
      <ServerComponent />
      <MaxWidthWapper>
        <MenuCards />
      </MaxWidthWapper>
    </HydrateClient>
  );
}
