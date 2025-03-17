export type Dessert = {
  id: string;
  name: string;
  chineseName: string;
  priceInCents: number;
  description: string;
  ingredients: string;
  imagePath: string;
  isAvailableForPurchase: boolean;
};

export type dessertFromDB = {
  id: string;
  name: string;
  chineseName: string;
  description: string;
  ingredients: string[];
  priceInCents: number;
  isAvailableForPurchase: boolean;
  imagePath: string;
};
