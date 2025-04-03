import { $Enums } from "@prisma/client";

export type DessertOnForm = {
  id: string;
  name: string;
  chineseName: string;
  priceInCents: number;
  description: string;
  ingredients: string;
  imagePath: string;
  isAvailableForPurchase: boolean;
  category: {
    id: string;
    name: string;
  };
};

export type dessertFromDB = {
  id: string;
  name: string;
  chineseName: string;
  description: string | null;
  ingredients: string[];
  priceInCents: number;
  isAvailableForPurchase: boolean;
  imagePath: string;
  category: {
    id: string;
    name: string;
  };
};

export type dessertOnClient = {
  id: string;
  name: string;
  chineseName: string;
  description: string | null;
  ingredients: string[];
  priceInCents: number;
  imagePath: string;
};

export type CustomerInfo = {
  customerFirstName: string;
  customerLastName: string;
  customerEmail: string;
  phone: string | null;
};

export type OrderType = {
  id: string;
  tempOrderId: string;
  priceInCents: number;
  createdAt: Date;
  updatedAt: Date;
  customerFirstName: string;
  customerLastName: string;
  customerEmail: string;
  customerPhoneNumber: string | null;
  completedAt: Date | null;
  pickedUpAt: Date | null;
  status: $Enums.Status; // Assuming $Enums.Status refers to an enum for order status
  desserts: {
    id: string;
    dessertId: string;
    orderId: string;
    quantity: number;
    dessert: {
      id: string;
      name: string;
      chineseName: string;
    };
    customisations: {
      customisationId: string;
      quantity: number;
      customisation: {
        id: string;
        name: string;
        priceInCents: number;
        isAvailableForPurchase: boolean;
      };
    }[];
  }[];
};

export type FullOrderType = {
  id: string;
  tempOrderId: string;
  priceInCents: number;
  createdAt: Date;
  updatedAt: Date;
  customerFirstName: string;
  customerLastName: string;
  customerEmail: string;
  customerPhoneNumber: string | null;
  completedAt: Date | null;
  pickedUpAt: Date | null;
  pickUpTime: Date;
  status: $Enums.Status; // Assuming $Enums.Status refers to an enum for order status
  desserts: {
    id: string;
    dessertId: string;
    orderId: string;
    quantity: number;
    dessert: {
      id: string;
      name: string;
      chineseName: string;
      imagePath: string;
      priceInCents: number;
    };
    customisations: {
      id: string;
      customisationId: string;
      quantity: number;
      customisation: {
        id: string;
        name: string;
        priceInCents: number;
        isAvailableForPurchase: boolean;
      };
    }[];
  }[];
};

export type Category = {
  id: string;
  name: string;
};

export type Customisation = {
  name: string;
  chineseName: string;
  priceInCents: string;
  id?: string;
  isAvailableForPurchase?: boolean;
  categories: Category[];
};
