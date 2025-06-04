// src/app/api/upload/route.ts

import { NextResponse } from "next/server";
import cloudinary from "~/lib/cloudinary";
import { db } from "~/server/db";

// Handle POST request for uploading an image
export async function PATCH(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("image") as File;
    const productId = formData.get("productId") as string;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const product = await db.dessert.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    const arrayBuffer = await file.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString("base64");
    const dataUri = `data:${file.type};base64,${base64Image}`;

    await cloudinary.uploader.destroy(product.imagePublicId);

    const uploadedResponse = await cloudinary.uploader.upload(dataUri, {
      use_filename: true,
      folder: "products",
    });
    const imagePath = uploadedResponse.secure_url;
    const imagePublicId = uploadedResponse.public_id;

    return NextResponse.json({ imagePath, imagePublicId }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update Image" },
      { status: 500 },
    );
  }
}
