/**
 * Product Service
 * Handles reading and parsing the product CSV file
 */

import { promises as fs } from 'fs';
import path from 'path';

export interface Product {
  handle: string;
  title: string;
  description: string;
  vendor: string;
  type: string;
  tags: string[];
  published: boolean;
  images: string[];
  variants: ProductVariant[];
}

export interface ProductVariant {
  sku: string;
  option1Name: string;
  option1Value: string;
  option2Name?: string;
  option2Value?: string;
  price: number;
  compareAtPrice?: number;
  weightGrams: number;
  inventoryQty: number;
  inStock: boolean;
  images: string[];
}

/**
 * Parse CSV line handling quoted fields
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

/**
 * Parse CSV text into rows
 */
function parseCSV(csvText: string): Record<string, string>[] {
  // Remove BOM if present
  if (csvText.charCodeAt(0) === 0xFEFF) {
    csvText = csvText.substring(1);
  }

  // Normalize line endings
  csvText = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const lines: string[] = [];
  let currentRow = '';
  let inQuotes = false;

  // Split into lines while respecting quotes
  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];

    if (char === '"') {
      inQuotes = !inQuotes;
      currentRow += char;
    } else if (char === '\n' && !inQuotes) {
      if (currentRow.trim()) {
        lines.push(currentRow);
      }
      currentRow = '';
    } else {
      currentRow += char;
    }
  }
  if (currentRow.trim()) lines.push(currentRow);

  if (lines.length < 2) {
    return [];
  }

  let headers = parseCSVLine(lines[0]);

  // Remove empty trailing columns from headers
  while (headers.length > 0 && headers[headers.length - 1].trim() === '') {
    headers.pop();
  }

  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);

    // Pad with empty strings if needed
    while (values.length < headers.length) {
      values.push('');
    }

    if (values.length !== headers.length) {
      continue;
    }

    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index];
    });

    rows.push(row);
  }

  return rows;
}

/**
 * Strip HTML tags from text
 */
function stripHTML(html: string): string {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Group CSV rows by product handle
 */
function groupProductsByHandle(rows: Record<string, string>[]): Product[] {
  const productsMap = new Map<string, Product>();

  rows.forEach((row) => {
    const handle = row.Handle;
    if (!handle) return;

    const isMainRow = !!row.Title;

    if (!productsMap.has(handle)) {
      if (!isMainRow) return;

      // Handle both CSV formats (Playwell vs muaythai-boxing.com)
      const bodyHTML = row['Body (HTML)'] || row['Body HTML'] || '';
      const published = row.Published ? row.Published === 'TRUE' : true; // Default to true if column doesn't exist
      const tags = row.Tags ? row.Tags.split(',').map((t) => t.trim()) : [];

      productsMap.set(handle, {
        handle,
        title: row.Title,
        description: stripHTML(bodyHTML),
        vendor: row.Vendor,
        type: row.Type,
        tags,
        published,
        images: row['Image Src'] ? [row['Image Src']] : [],
        variants: [],
      });
    }

    const product = productsMap.get(handle)!;

    if (row['Image Src'] && !product.images.includes(row['Image Src'])) {
      product.images.push(row['Image Src']);
    }

    // Add variant if this row has variant data
    if (row['Variant SKU']) {
      // Handle weight in grams (Playwell uses "Variant Grams", MTB uses "Variant Weight" in grams)
      const weightGrams = parseInt(row['Variant Grams']) || parseInt(row['Variant Weight']) || 0;

      const variant: ProductVariant = {
        sku: row['Variant SKU'],
        option1Name: row['Option1 Name'] || 'Title',
        option1Value: row['Option1 Value'] || product.title,
        option2Name: row['Option2 Name'] || undefined,
        option2Value: row['Option2 Value'] || undefined,
        price: parseFloat(row['Variant Price']) || 0,
        compareAtPrice: row['Variant Compare At Price']
          ? parseFloat(row['Variant Compare At Price'])
          : undefined,
        weightGrams,
        inventoryQty: parseInt(row['Variant Inventory Qty']) || 0,
        inStock: parseInt(row['Variant Inventory Qty']) > 0,
        images: row['Variant Images'] ? [row['Variant Images']] : [],
      };

      product.variants.push(variant);
    }
  });

  return Array.from(productsMap.values());
}

export class ProductService {
  private csvFilePath: string;

  constructor() {
    this.csvFilePath = path.join(process.cwd(), 'data', 'mtb-product-export.csv');
  }

  /**
   * Get all products from CSV
   */
  async getAllProducts(): Promise<Product[]> {
    try {
      // Check if file exists
      const fileExists = await fs
        .access(this.csvFilePath)
        .then(() => true)
        .catch(() => false);

      if (!fileExists) {
        throw new Error('Product CSV file not found. Please run CSV sync first.');
      }

      // Read and parse CSV
      const csvText = await fs.readFile(this.csvFilePath, 'utf-8');
      const rows = parseCSV(csvText);
      console.log(`[Product Service] Parsed ${rows.length} CSV rows`);

      const products = groupProductsByHandle(rows);
      console.log(`[Product Service] Grouped into ${products.length} products`);

      const publishedProducts = products.filter((p) => p.published && p.variants.length > 0);
      console.log(`[Product Service] Filtered to ${publishedProducts.length} published products with variants`);

      return publishedProducts;
    } catch (error) {
      console.error('[Product Service] Failed to get products:', error);
      throw error;
    }
  }

  /**
   * Get products by category/type
   */
  async getProductsByType(type: string): Promise<Product[]> {
    const products = await this.getAllProducts();
    return products.filter((p) =>
      p.type.toLowerCase().includes(type.toLowerCase())
    );
  }

  /**
   * Get product by handle
   */
  async getProductByHandle(handle: string): Promise<Product | null> {
    const products = await this.getAllProducts();
    return products.find((p) => p.handle === handle) || null;
  }

  /**
   * Get CSV file status
   */
  async getFileStatus(): Promise<{
    exists: boolean;
    lastModified?: Date;
    size?: number;
  }> {
    try {
      const stats = await fs.stat(this.csvFilePath);
      return {
        exists: true,
        lastModified: stats.mtime,
        size: stats.size,
      };
    } catch (error) {
      return {
        exists: false,
      };
    }
  }
}

// Export singleton instance
export const productService = new ProductService();
