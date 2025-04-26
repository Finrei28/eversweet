"use client";

import { dessertFromDB } from "~/app/components/types";
import { AddProduct } from "./addProduct";
import { EditProduct } from "./editProduct";
import { api } from "~/trpc/react";
import { useLanguage } from "~/app/components/language";

type ProductDialogContextProps = {
  product?: dessertFromDB;
};

export default function ProductDialogContext({
  product,
}: ProductDialogContextProps) {
  const [categories] = api.dessert.getCategories.useSuspenseQuery();
  const { language } = useLanguage();
  return (
    <>
      {product ? (
        <EditProduct
          triggerText={language === "en" ? "Edit" : "编辑"}
          title={language === "en" ? "Edit dessert" : "编辑甜点"}
          description={
            language === "en"
              ? "Edit and hit 'Save' to save the changes"
              : "编辑并点击'保存'以保存更改"
          }
          fields={[
            { id: "id", label: "id", value: product.id },
            {
              id: "name",
              label: language === "en" ? "Dessert name" : "产品名",
              value: product.name,
            },
            {
              id: "chineseName",
              label: language === "en" ? "Chinese name" : "中文名",
              value: product.chineseName,
            },
            {
              id: "description",
              label: language === "en" ? "Description" : "描述",
              value: product.description ?? "",
            },
            {
              id: "ingredients",
              label: language === "en" ? "Ingredients" : "原料",
              value: product.ingredients.join(","),
            },
            {
              id: "categoryId",
              label: language === "en" ? "Category" : "类别",
              value: product.category.id,
            },
            {
              id: "priceInCents",
              label: language === "en" ? "Price in cents" : "价格(分)",
              value: product.priceInCents.toString(),
            },
            // change type back to file when working with database
            {
              id: "image",
              label: language === "en" ? "Image" : "图片",
              type: "file",
              value: product.imagePath,
            },
            {
              id: "isAvailableForPurchase",
              label: language === "en" ? "Availability" : "可用性",
              value: product.isAvailableForPurchase.toString(),
            },
          ]}
          submitText={language === "en" ? "Save" : "保存"}
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
          triggerText={language === "en" ? "Add dessert" : "添加甜点"}
          title={language === "en" ? "Add a new dessert" : "添加新甜点"}
          description={
            language === "en"
              ? "fill in the inputs and hit 'Add' to submit a new dessert"
              : "填写输入并点击'添加'以提交新甜点"
          }
          fields={[
            {
              id: "name",
              label: language === "en" ? "Dessert name" : "产品名",
            },
            {
              id: "chineseName",
              label: language === "en" ? "Chinese name" : "中文名",
            },
            {
              id: "description",
              label: language === "en" ? "Description" : "描述",
            },
            {
              id: "ingredients",
              label: language === "en" ? "Ingredients" : "原料",
            },
            {
              id: "categoryId",
              label: language === "en" ? "Category" : "类别",
            },
            {
              id: "priceInCents",
              label: language === "en" ? "Price in cents" : "价格(分)",
            },
            {
              id: "image",
              label: language === "en" ? "Image" : "图片",
              type: "file",
            },
          ]}
          submitText={language === "en" ? "Add" : "添加"}
          categories={categories}
        />
      )}
    </>
  );
}
