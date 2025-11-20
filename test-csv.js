const fs = require('fs');
const path = require('path');

const csvPath = path.join(__dirname, 'data', 'mtb-product-export.csv');
const csvText = fs.readFileSync(csvPath, 'utf-8');

// Get first 2000 characters
console.log('CSV Preview (first 2000 chars):');
console.log(csvText.substring(0, 2000));
console.log('\n\n');

// Get headers
const firstLine = csvText.split('\n')[0];
console.log('Headers:', firstLine);
console.log('\n');

// Count lines
const lines = csvText.split('\n').filter(l => l.trim());
console.log('Total lines:', lines.length);
