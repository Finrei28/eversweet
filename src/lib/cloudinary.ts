import { v2 as cloudinary } from "cloudinary";
import crypto from "crypto";

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

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export default cloudinary;
