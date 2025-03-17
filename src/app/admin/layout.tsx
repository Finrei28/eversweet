import { Navbar, NavbarLink } from "../components/navbar";

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <Navbar>
        <NavbarLink href={"/admin"}>Dashboard</NavbarLink>
        <NavbarLink href={"/admin/products"}>Products</NavbarLink>
        <NavbarLink href={"/admin/orders"}>Orders</NavbarLink>
        <NavbarLink href={"/admin/past-orders"}>Past Orders</NavbarLink>
      </Navbar>
      <div className="my-6">{children}</div>
    </>
  );
}
