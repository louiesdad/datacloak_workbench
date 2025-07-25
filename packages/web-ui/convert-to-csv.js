const fs = require('fs');

// Read the TSV data
const tsvData = `id	name	email	phone	ssn	review	rating	date
1	Jane Smith	user1@example.com	(555) 001-0001	101-11-1001	Very disappointed with this purchase.	1	1/2/24
2	Bob Johnson	user2@example.com	(555) 002-0002	102-12-1002	Not bad but not great either.	4	1/3/24
3	Alice Williams	user3@example.com	(555) 003-0003	103-13-1003	Highly recommend to everyone! 10/10!	4	1/4/24
4	Charlie Brown	user4@example.com	(555) 004-0004	104-14-1004	Worst product I've ever bought.	1	1/5/24
5	John Doe	user5@example.com	(555) 005-0005	105-15-1005	It's okay nothing special.	3	1/6/24`;

// Convert TSV to CSV with proper quoting
const lines = tsvData.split('\n');
const csvLines = lines.map(line => {
  const fields = line.split('\t');
  return fields.map(field => {
    // Quote fields that contain commas, quotes, or newlines
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  }).join(',');
});

const csvData = csvLines.join('\n');

// Write the CSV file
fs.writeFileSync('test-data-proper.csv', csvData, 'utf8');
console.log('Created test-data-proper.csv');
console.log('First few lines:');
console.log(csvData.split('\n').slice(0, 3).join('\n'));