export function registerRoutes(router, dependencies) {
  const { auth, Upload, cloudinary, uploadFile } = dependencies;
  router.post('/api/uploads', auth, (req, res) => {
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      return res.status(503).json({ message: 'Set the Cloudinary environment variables before uploading files.' });
    }
    uploadFile.single('file')(req, res, async (error) => {
      if (error) return res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ message: error.message || 'File could not be uploaded.' });
      if (!req.file) return res.status(400).json({ message: 'Choose a file to upload.' });
      try {
        const result = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream({ folder: 'relay-chat', resource_type: 'auto' }, (uploadError, uploaded) => {
            if (uploadError) reject(uploadError);
            else resolve(uploaded);
          });
          stream.end(req.file.buffer);
        });
        const upload = await Upload.create({
          ownerId: req.user._id, url: result.secure_url, publicId: result.public_id,
          resourceType: result.resource_type, name: req.file.originalname.slice(0, 255),
          mimeType: req.file.mimetype, size: req.file.size,
        });
        return res.status(201).json({ upload: { _id: String(upload._id), url: upload.url, publicId: upload.publicId, resourceType: upload.resourceType, name: upload.name, mimeType: upload.mimeType, size: upload.size } });
      } catch (uploadError) {
        console.error('upload failed', uploadError.message);
        return res.status(502).json({ message: 'Cloud storage could not accept the file.' });
      }
    });
  });
  router.delete('/api/uploads/:uploadId', auth, async (req, res) => {
    try {
      const upload = await Upload.findOneAndDelete({ _id: req.params.uploadId, ownerId: req.user._id, attachedAt: null });
      if (!upload) return res.status(404).json({ message: 'That pending upload is not available.' });
      await cloudinary.uploader.destroy(upload.publicId, { resource_type: upload.resourceType }).catch(() => null);
      return res.json({ ok: true });
    } catch {
      return res.status(400).json({ message: 'That upload could not be removed.' });
    }
  });
}
