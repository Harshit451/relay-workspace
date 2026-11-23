import { v2 as cloudinary } from 'cloudinary';

export function configureCloudinary(env = process.env) {
  cloudinary.config({ cloud_name: env.CLOUDINARY_CLOUD_NAME, api_key: env.CLOUDINARY_API_KEY, api_secret: env.CLOUDINARY_API_SECRET });
  return cloudinary;
}

export { cloudinary };
