// src/app/api/upload/route.ts

import { NextResponse } from "next/server";
import cloudinary from "~/lib/cloudinary";
import { db } from "~/server/db";
import { generateHash, imageExists } from "../uploadImage/route";

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

    const imageExistsInOtherProduct = await db.dessert.findFirst({
      where: {
        imagePublicId: product.imagePublicId,
      },
    });
    if (!imageExistsInOtherProduct) {
      await cloudinary.uploader.destroy(product.imagePublicId);
    }

    // Generate content-based hash for deduplication
    const hash = generateHash(arrayBuffer);
    const publicId = `products/${hash}`;

    // Check if this image already exists
    const exists = await imageExists(publicId);

    if (exists) {
      const existing = await cloudinary.api.resource(publicId);

      return NextResponse.json({
        imagePath: existing.secure_url,
        publicId: existing.public_id,
        fromCache: true,
      });
    }

    const uploadedResponse = await cloudinary.uploader.upload(dataUri, {
      public_id: publicId,
      use_filename: false,
      folder: "products",
      overwrite: false,
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
