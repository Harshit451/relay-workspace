import multer from 'multer';

const acceptedMimeTypes = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf', 'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

export const uploadFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter(_req, file, callback) {
    const accepted = acceptedMimeTypes.has(file.mimetype);
    callback(accepted ? null : new Error('Choose an image, PDF, text file, or DOCX file.'), accepted);
  },
});
