// src/app/api/upload/route.ts

import { NextResponse } from "next/server";
import cloudinary from "~/lib/cloudinary";

// Handle POST request for uploading an image
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

    const uploadedResponse = await cloudinary.uploader.upload(dataUri, {
      use_filename: true,
      folder: "products",
    });
    const imagePath = uploadedResponse.secure_url;
    const publicId = uploadedResponse.public_id;

    return NextResponse.json({ imagePath, publicId }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to upload Image" },
      { status: 500 },
    );
  }
}
