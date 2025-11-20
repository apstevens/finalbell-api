/**
 * Product Routes
 * Public endpoints for product data
 */

import { Router } from 'express';
import {
  getAllProducts,
  getProductsByType,
  getProductByHandle,
  getProductFileStatus,
} from '../controllers/productController';

const router = Router();

// Get all products
router.get('/', getAllProducts);

// Get CSV file status
router.get('/status', getProductFileStatus);

// Get products by type (must be before /:handle to avoid conflict)
router.get('/type/:type', getProductsByType);

// Get product by handle
router.get('/:handle', getProductByHandle);

export default router;
