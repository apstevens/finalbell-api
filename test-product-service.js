const { productService } = require('./dist/services/productService');

async function test() {
  try {
    console.log('Testing product service...');
    const products = await productService.getAllProducts();
    console.log(`Found ${products.length} products`);

    if (products.length > 0) {
      console.log('\nFirst product:');
      console.log(JSON.stringify(products[0], null, 2));
    }
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

test();
