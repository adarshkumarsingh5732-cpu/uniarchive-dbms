import express from 'express';
import {
    getResources,
    getResourceByIdHandler,
    previewResourceHandler,
    downloadResourceHandler,
    createResourceHandler,
    updateInteractionHandler,
    addCommentHandler
} from '../controllers/resourceController.js';
import upload from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.route('/')
    .get(getResources)
    .post(upload.single('file'), createResourceHandler);

router.route('/:id').get(getResourceByIdHandler);

// The trailing filename is decorative but load-bearing: Chrome's PDF viewer
// names a saved inline file after the URL's last segment.
router.route('/:id/preview/:filename?').get(previewResourceHandler);
router.route('/:id/download/:filename?').get(downloadResourceHandler);

router.route('/:id/comments').post(addCommentHandler);

router.route('/:id/:action').post(updateInteractionHandler); // action: view, download, upvote

export default router;
