import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { api } from "~/trpc/react";

type CustomerDetailsProps = {
  customerDetailsOpen: { id: string; open: boolean };
  handleChangeOpen: () => void;
};

export default function CustomerDetails({
  customerDetailsOpen,
  handleChangeOpen,
}: CustomerDetailsProps) {
  let customer;
  if (customerDetailsOpen.id) {
    [customer] = api.order.getCustomerDetails.useSuspenseQuery({
      id: customerDetailsOpen.id,
    });
  }

  return (
    customer && (
      <Dialog open={customerDetailsOpen.open} onOpenChange={handleChangeOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex justify-center text-xl">
              Customer Details
            </DialogTitle>
            <DialogDescription />
          </DialogHeader>
          <div className="max-h-[50vh] space-y-4 overflow-y-auto border-b border-gray-100 py-2 pb-4">
            <div className="flex items-center gap-4">
              <div className="flex flex-1 flex-col space-y-5">
                <div>
                  <h3 className="text-xl font-medium text-gray-900 2xl:text-base">
                    First Name
                  </h3>

                  <p className="ml-1 mt-1 items-center text-xl text-gray-500 2xl:text-base">
                    {customer?.customerFirstName}
                  </p>
                </div>
                <div>
                  <h3 className="text-xl font-medium text-gray-900 2xl:text-base">
                    Last Name
                  </h3>

                  <p className="ml-1 mt-1 items-center text-xl text-gray-500 2xl:text-base">
                    {customer?.customerLastName}
                  </p>
                </div>
                <div>
                  <h3 className="text-xl font-medium text-gray-900 2xl:text-base">
                    Email
                  </h3>

                  <p className="ml-1 mt-1 items-center text-xl text-gray-500 2xl:text-base">
                    {customer?.customerEmail}
                  </p>
                </div>
                <div>
                  <h3 className="text-xl font-medium text-gray-900 2xl:text-base">
                    Phone Number
                  </h3>

                  <p className="ml-1 mt-1 items-center text-xl text-gray-500 2xl:text-base">
                    {customer?.customerPhoneNumber}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit">Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  );
}
