const fs = require('fs');
const path = require('path');

// Helper to generate CSV content
function generateCSVContent(rows, includePII = false) {
  const headers = includePII 
    ? ['id', 'name', 'email', 'phone', 'ssn', 'review', 'rating', 'date']
    : ['id', 'product', 'review', 'rating', 'date'];
  
  const data = [headers.join(',')];
  
  // Sample data for generation
  const names = ['John Doe', 'Jane Smith', 'Bob Johnson', 'Alice Williams', 'Charlie Brown'];
  const products = ['Laptop', 'Phone', 'Tablet', 'Headphones', 'Keyboard'];
  const positiveReviews = [
    "This product is amazing! Best purchase ever!",
    "Absolutely love it! Exceeded all expectations!",
    "Fantastic quality and great value for money!",
    "Highly recommend to everyone! 10/10!",
    "Outstanding product with excellent features!"
  ];
  const negativeReviews = [
    "Terrible quality, complete waste of money.",
    "Very disappointed with this purchase.",
    "Does not work as advertised. Avoid!",
    "Poor quality and horrible customer service.",
    "Worst product I've ever bought."
  ];
  const neutralReviews = [
    "It's okay, nothing special.",
    "Average product, does what it says.",
    "Not bad, but not great either.",
    "Acceptable quality for the price.",
    "It works, I guess."
  ];
  
  for (let i = 1; i <= rows; i++) {
    let review;
    if (i % 3 === 0) review = positiveReviews[i % 5];
    else if (i % 3 === 1) review = negativeReviews[i % 5];
    else review = neutralReviews[i % 5];
    
    const row = includePII ? [
      i,
      names[i % names.length],
      `user${i}@example.com`,
      `(555) ${String(i).padStart(3, '0')}-${String(i % 1000).padStart(4, '0')}`,
      `${String(i % 900 + 100)}-${String(i % 90 + 10)}-${String(i % 9000 + 1000)}`,
      review,
      Math.floor(Math.random() * 5) + 1,
      new Date(2024, 0, 1 + (i % 365)).toISOString().split('T')[0]
    ] : [
      i,
      products[i % products.length],
      review,
      Math.floor(Math.random() * 5) + 1,
      new Date(2024, 0, 1 + (i % 365)).toISOString().split('T')[0]
    ];
    
    data.push(row.join(','));
  }
  
  return data.join('\n');
}

// Generate test files
console.log('Generating small-test.csv...');
fs.writeFileSync(
  path.join(__dirname, 'small-test.csv'),
  generateCSVContent(100, false)
);

console.log('Generating medium-test.csv...');
fs.writeFileSync(
  path.join(__dirname, 'medium-test.csv'),
  generateCSVContent(10000, false)
);

console.log('Generating test-with-pii.csv...');
fs.writeFileSync(
  path.join(__dirname, 'test-with-pii.csv'),
  generateCSVContent(1000, true)
);

// Generate large file in chunks
console.log('Generating large-test.csv (this may take a while)...');
const largeFilePath = path.join(__dirname, 'large-test.csv');
const writeStream = fs.createWriteStream(largeFilePath);

// Write header
writeStream.write('id,product,review,rating,date,category,price,quantity\n');

// Write in batches
const batchSize = 10000;
const totalRows = 1000000;
const categories = ['Electronics', 'Books', 'Clothing', 'Home', 'Sports'];

for (let batch = 0; batch < totalRows / batchSize; batch++) {
  let batchData = '';
  
  for (let i = 1; i <= batchSize; i++) {
    const rowNum = batch * batchSize + i;
    let review;
    if (rowNum % 3 === 0) review = "Great product!";
    else if (rowNum % 3 === 1) review = "Not satisfied.";
    else review = "It's okay.";
    
    const row = [
      rowNum,
      'Product ' + (rowNum % 100),
      review,
      Math.floor(Math.random() * 5) + 1,
      new Date(2024, 0, 1 + (rowNum % 365)).toISOString().split('T')[0],
      categories[rowNum % categories.length],
      (Math.random() * 1000).toFixed(2),
      Math.floor(Math.random() * 100) + 1
    ];
    
    batchData += row.join(',') + '\n';
  }
  
  writeStream.write(batchData);
  
  if ((batch + 1) % 10 === 0) {
    console.log(`Progress: ${((batch + 1) * batchSize / totalRows * 100).toFixed(1)}%`);
  }
}

writeStream.end(() => {
  console.log('\nTest files generated successfully!');
  console.log('Files created:');
  console.log('- small-test.csv (100 rows)');
  console.log('- medium-test.csv (10,000 rows)');
  console.log('- test-with-pii.csv (1,000 rows with PII)');
  console.log('- large-test.csv (1,000,000 rows)');
});