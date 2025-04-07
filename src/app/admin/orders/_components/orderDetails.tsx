"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { api } from "~/trpc/react";
import Image from "next/image";
import Loader from "~/app/components/customLoading";

type CustomerDetailsProps = {
  orderDetailsOpen: { id: string; open: boolean };
  handleChangeOpen: () => void;
};

export default function CustomerDetails({
  orderDetailsOpen,
  handleChangeOpen,
}: CustomerDetailsProps) {
  const { data: order, isLoading } = api.order.getOrderDetails.useQuery({
    id: orderDetailsOpen.id,
  });

  if (!orderDetailsOpen.id) {
    return;
  }

  const getPickedUpTime = (dateString: string) => {
    const pickedUpTime = new Date(dateString);
    return new Intl.DateTimeFormat("en-NZ", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
    }).format(pickedUpTime);
  };
  return isLoading ? (
    <Dialog open={orderDetailsOpen.open} onOpenChange={handleChangeOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex justify-center text-xl">
            Order #{orderDetailsOpen.id}
          </DialogTitle>
          <DialogDescription />
        </DialogHeader>
        <Loader />
      </DialogContent>
    </Dialog>
  ) : (
    order && (
      <Dialog open={orderDetailsOpen.open} onOpenChange={handleChangeOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex justify-center text-xl">
              Order #{order?.tempOrderId}
            </DialogTitle>
            <DialogDescription />
          </DialogHeader>
          <div className="max-h-[50vh] space-y-4 overflow-y-auto border-b border-gray-100 py-2 pb-4">
            {order?.desserts.map((dessert) => (
              <div key={dessert.id} className="flex gap-4">
                <div className="relative h-16 w-16 flex-shrink-0 self-start overflow-hidden rounded-md border border-gray-200">
                  {dessert.dessert.imagePath && (
                    <Image
                      src={dessert.dessert.imagePath || "/placeholder.svg"}
                      alt={dessert.dessert.name}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                  )}
                </div>
                <div className="flex flex-1 flex-col text-xl 2xl:text-base">
                  <h3 className="font-medium text-gray-900">
                    {dessert.dessert.name} x{dessert.quantity}
                  </h3>
                  {dessert.customisations?.map((customisation) => (
                    <p
                      className="ml-1 items-center text-gray-500"
                      key={customisation.id}
                    >
                      {customisation.quantity > 1
                        ? `+${customisation.quantity} ${customisation.customisation.name}`
                        : customisation.quantity === 1
                          ? `+ ${customisation.customisation.name}`
                          : `-${customisation.customisation.name}`}
                    </p>
                  ))}
                </div>
              </div>
            ))}
            {order?.pickedUpAt && (
              <p>
                Picked up at: {getPickedUpTime(order.pickedUpAt.toISOString())}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    )
  );
}
