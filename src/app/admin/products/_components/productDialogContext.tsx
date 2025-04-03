"use client";

import { dessertFromDB } from "~/app/components/types";
import { AddProduct } from "./addProduct";
import { EditProduct } from "./editProduct";
import { api } from "~/trpc/react";

type ProductDialogContextProps = {
  product?: dessertFromDB;
};

export default function ProductDialogContext({
  product,
}: ProductDialogContextProps) {
  const [categories] = api.dessert.getCategories.useSuspenseQuery();
  return (
    <>
      {product ? (
        <EditProduct
          triggerText="Edit"
          title="Edit dessert"
          description="Edit and hit 'Save' to save the changes"
          fields={[
            { id: "id", label: "id", value: product.id },
            { id: "name", label: "Dessert name", value: product.name },
            {
              id: "chineseName",
              label: "Chinese name",
              value: product.chineseName,
            },
            {
              id: "description",
              label: "Description",
              value: product.description ?? "",
            },
            {
              id: "ingredients",
              label: "Ingredients",
              value: product.ingredients.join(","),
            },
            {
              id: "categoryId",
              label: "Category",
              value: product.category.id,
            },
            {
              id: "priceInCents",
              label: "Price in cents",
              value: product.priceInCents.toString(),
            },
            // change type back to file when working with database
            {
              id: "image",
              label: "Image",
              type: "file",
              value: product.imagePath,
            },
            {
              id: "isAvailableForPurchase",
              label: "Availability",
              value: product.isAvailableForPurchase.toString(),
            },
          ]}
          submitText="Save"
          formDefaultValues={{
            id: product.id,
            name: product.name,
            chineseName: product.chineseName,
            description: product.description ?? "",
            ingredients: product.ingredients.join(","),
            priceInCents: product.priceInCents,
            imagePath: product.imagePath,
            isAvailableForPurchase: product.isAvailableForPurchase,
            category: {
              id: product.category.id,
              name: product.category.name,
            },
          }}
          categories={categories}
        />
      ) : (
        <AddProduct
          triggerText="Add dessert"
          title="Add a new dessert"
          description="fill in the inputs and hit 'Add' to submit a new dessert"
          fields={[
            { id: "name", label: "Dessert name" },
            { id: "chineseName", label: "Chinese name" },
            { id: "description", label: "Description" },
            { id: "ingredients", label: "Ingredients" },
            { id: "categoryId", label: "Category" },
            { id: "priceInCents", label: "Price in cents" },
            { id: "image", label: "Image", type: "file" },
          ]}
          submitText="Add"
          categories={categories}
        />
      )}
    </>
  );
}
