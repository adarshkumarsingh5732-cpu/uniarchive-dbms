import multer from 'multer';
import path from 'path';

const storage = multer.memoryStorage();

function checkFileType(file: Express.Multer.File, cb: multer.FileFilterCallback) {
    const filetypesRegex = /\.(pdf|jpg|jpeg|png|webp|doc|docx)$/i;
    const ext = path.extname(file.originalname).toLowerCase();
    const isAllowedExt = filetypesRegex.test(ext);

    // Accept standard mimetypes OR generic octet-stream when extension is valid
    const isAllowedMime = /pdf|image|doc|octet-stream|wordprocessingml/i.test(file.mimetype);

    if (isAllowedExt && (isAllowedMime || !file.mimetype)) {
        return cb(null, true);
    } else {
        cb(new Error(`Invalid file type! Extension: ${ext}, Mime: ${file.mimetype}`));
    }
}

const upload = multer({
    storage,
    limits: { fileSize: 25000000 }, // 25MB
    fileFilter: function (req, file, cb) {
        checkFileType(file, cb);
    },
});

export default upload;
