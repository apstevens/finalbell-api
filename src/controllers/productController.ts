/**
 * Product Controller
 * Handles product-related API requests
 */

import { Request, Response } from 'express';
import { productService } from '../services/productService';

/**
 * Get all products
 * GET /products
 */
export const getAllProducts = async (req: Request, res: Response) => {
  try {
    const products = await productService.getAllProducts();

    res.json({
      success: true,
      count: products.length,
      data: products,
    });
  } catch (error) {
    console.error('[Product Controller] Get all products error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch products',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Get products by type/category
 * GET /products/type/:type
 */
export const getProductsByType = async (req: Request, res: Response) => {
  try {
    const { type } = req.params;

    if (!type) {
      res.status(400).json({
        success: false,
        message: 'Product type is required',
      });
      return;
    }

    const products = await productService.getProductsByType(type);

    res.json({
      success: true,
      count: products.length,
      type,
      data: products,
    });
  } catch (error) {
    console.error('[Product Controller] Get products by type error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch products',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Get product by handle
 * GET /products/:handle
 */
export const getProductByHandle = async (req: Request, res: Response) => {
  try {
    const { handle } = req.params;

    if (!handle) {
      res.status(400).json({
        success: false,
        message: 'Product handle is required',
      });
      return;
    }

    const product = await productService.getProductByHandle(handle);

    if (!product) {
      res.status(404).json({
        success: false,
        message: 'Product not found',
      });
      return;
    }

    res.json({
      success: true,
      data: product,
    });
  } catch (error) {
    console.error('[Product Controller] Get product by handle error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch product',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Get CSV file status
 * GET /products/status
 */
export const getProductFileStatus = async (_req: Request, res: Response) => {
  try {
    const status = await productService.getFileStatus();

    res.json({
      success: true,
      status,
    });
  } catch (error) {
    console.error('[Product Controller] Get file status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get file status',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
