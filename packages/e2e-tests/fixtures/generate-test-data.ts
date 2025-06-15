import * as fs from 'fs';
import * as path from 'path';
import { faker } from '@faker-js/faker';

// Helper to generate CSV content
function generateCSVContent(rows: number, includePII: boolean = false): string {
  const headers = includePII 
    ? ['id', 'name', 'email', 'phone', 'ssn', 'review', 'rating', 'date']
    : ['id', 'product', 'review', 'rating', 'date'];
  
  const data: string[] = [headers.join(',')];
  
  for (let i = 1; i <= rows; i++) {
    const row = includePII ? [
      i.toString(),
      faker.person.fullName(),
      faker.internet.email(),
      faker.phone.number('(###) ###-####'),
      faker.string.numeric('###-##-####'),
      generateReview(i),
      Math.floor(Math.random() * 5) + 1,
      faker.date.past().toISOString().split('T')[0]
    ] : [
      i.toString(),
      faker.commerce.productName(),
      generateReview(i),
      Math.floor(Math.random() * 5) + 1,
      faker.date.past().toISOString().split('T')[0]
    ];
    
    // Escape quotes and wrap fields containing commas
    const escapedRow = row.map(field => {
      const str = String(field);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    });
    
    data.push(escapedRow.join(','));
  }
  
  return data.join('\n');
}

// Generate reviews with known sentiments
function generateReview(index: number): string {
  const sentiments = {
    positive: [
      "This product is amazing! Best purchase ever!",
      "Absolutely love it! Exceeded all expectations!",
      "Fantastic quality and great value for money!",
      "Highly recommend to everyone! 10/10!",
      "Outstanding product with excellent features!"
    ],
    negative: [
      "Terrible quality, complete waste of money.",
      "Very disappointed with this purchase.",
      "Does not work as advertised. Avoid!",
      "Poor quality and horrible customer service.",
      "Worst product I've ever bought."
    ],
    neutral: [
      "It's okay, nothing special.",
      "Average product, does what it says.",
      "Not bad, but not great either.",
      "Acceptable quality for the price.",
      "It works, I guess."
    ]
  };
  
  // Distribute sentiments predictably
  if (index % 3 === 0) return sentiments.positive[index % 5];
  if (index % 3 === 1) return sentiments.negative[index % 5];
  return sentiments.neutral[index % 5];
}

// Generate test files
async function generateTestFiles() {
  const fixturesDir = path.join(__dirname);
  
  // Ensure directory exists
  if (!fs.existsSync(fixturesDir)) {
    fs.mkdirSync(fixturesDir, { recursive: true });
  }
  
  // Generate small-test.csv (100 rows)
  console.log('Generating small-test.csv...');
  fs.writeFileSync(
    path.join(fixturesDir, 'small-test.csv'),
    generateCSVContent(100, false)
  );
  
  // Generate medium-test.csv (10,000 rows)
  console.log('Generating medium-test.csv...');
  fs.writeFileSync(
    path.join(fixturesDir, 'medium-test.csv'),
    generateCSVContent(10000, false)
  );
  
  // Generate test-with-pii.csv (1,000 rows with PII)
  console.log('Generating test-with-pii.csv...');
  fs.writeFileSync(
    path.join(fixturesDir, 'test-with-pii.csv'),
    generateCSVContent(1000, true)
  );
  
  // Generate large-test.csv (1M rows) - Note: This will be ~100MB, not 1GB
  console.log('Generating large-test.csv (this may take a while)...');
  const largeFilePath = path.join(fixturesDir, 'large-test.csv');
  const writeStream = fs.createWriteStream(largeFilePath);
  
  // Write header
  writeStream.write('id,product,review,rating,date,category,price,quantity\n');
  
  // Write in batches to avoid memory issues
  const batchSize = 10000;
  const totalRows = 1000000;
  
  for (let batch = 0; batch < totalRows / batchSize; batch++) {
    let batchData = '';
    
    for (let i = 1; i <= batchSize; i++) {
      const rowNum = batch * batchSize + i;
      const row = [
        rowNum,
        faker.commerce.productName(),
        generateReview(rowNum),
        Math.floor(Math.random() * 5) + 1,
        faker.date.past().toISOString().split('T')[0],
        faker.commerce.department(),
        faker.commerce.price(),
        faker.number.int({ min: 1, max: 100 })
      ];
      
      batchData += row.join(',') + '\n';
    }
    
    writeStream.write(batchData);
    
    if ((batch + 1) % 10 === 0) {
      console.log(`Progress: ${((batch + 1) * batchSize / totalRows * 100).toFixed(1)}%`);
    }
  }
  
  writeStream.end();
  
  console.log('\nTest files generated successfully!');
  console.log('Files created:');
  console.log('- small-test.csv (100 rows)');
  console.log('- medium-test.csv (10,000 rows)');
  console.log('- test-with-pii.csv (1,000 rows with PII)');
  console.log('- large-test.csv (1,000,000 rows)');
}

// Run if called directly
if (require.main === module) {
  generateTestFiles().catch(console.error);
}

export { generateTestFiles, generateCSVContent };