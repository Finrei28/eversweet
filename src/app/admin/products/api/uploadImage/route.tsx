// src/app/api/upload/route.ts

import { NextResponse } from "next/server";
import cloudinary from "~/lib/cloudinary";
import crypto from "crypto";

// Generate SHA1 hash of image buffer
export function generateHash(buffer: ArrayBuffer) {
  return crypto.createHash("sha1").update(Buffer.from(buffer)).digest("hex");
}

// Check if an image with a given public_id exists in Cloudinary
export async function imageExists(publicId: string): Promise<boolean> {
  try {
    await cloudinary.api.resource(publicId);
    return true;
  } catch (err: any) {
    if (err.error.http_code === 404) {
      return false;
    }

    throw err;
  }
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("image") as File;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString("base64");
    const dataUri = `data:${file.type};base64,${base64Image}`;

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

    // Upload new image
    const uploadedResponse = await cloudinary.uploader.upload(dataUri, {
      public_id: publicId,
      use_filename: false,
      folder: "products",
      overwrite: false,
    });

    return NextResponse.json({
      imagePath: uploadedResponse.secure_url,
      publicId: uploadedResponse.public_id,
      fromCache: false,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to upload Image" },
      { status: 500 },
    );
  }
}
