import MaxWidthWapper from "~/app/components/maxWidthWrapper";

export default function ContactPage() {
  return (
    <div className="">
      <div className="mx-auto flex h-24 flex-col items-center justify-center bg-secondary">
        <h1 className="text-4xl">Contact</h1>
      </div>
      <MaxWidthWapper>
        <section className="mt-10">
          <h2 className="ml-2 text-xl font-semibold">Our phone number</h2>
          <p className="rounded-xl bg-secondary p-4">
            Phone number not set up yet...
          </p>
        </section>
        <section className="mt-10">
          <h2 className="ml-2 text-xl font-semibold">Our email</h2>
          <p className="rounded-xl bg-secondary p-4">
            You can contact us through our email: eversweet@eversweet.co.nz
          </p>
        </section>
        <section className="mt-10">
          <h2 className="ml-2 text-xl font-semibold">Our shop</h2>
          <div className="rounded-xl bg-secondary p-4">
            <p>
              You can come visit us at our shop and our friendly staff will be
              able to help you there.
            </p>
            <p>
              We are located at 5D/119 Meadowland Drive, Somerville, Auckland
              2014.
            </p>
          </div>
        </section>
      </MaxWidthWapper>
    </div>
  );
}
