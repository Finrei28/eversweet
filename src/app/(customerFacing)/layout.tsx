import Link from "next/link";
import { Navbar, NavbarLink } from "../components/navbar";

export default function CustomerFacingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <Navbar>
        <NavbarLink href={"/menu"}>Menu</NavbarLink>
        <NavbarLink href={"/about-us"}>About us</NavbarLink>
        <NavbarLink href={"/contact"}>Contact</NavbarLink>
        <NavbarLink href={"/feedback"}>Feedback</NavbarLink>
      </Navbar>

      <div className="my-6">{children}</div>
    </>
  );
}
