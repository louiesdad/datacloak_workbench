const Papa = require('papaparse');
const fs = require('fs');

const tsvContent = fs.readFileSync('/Users/thomaswagner/Documents/datacloak-sentiment-workbench/packages/web-ui/test-data.tsv', 'utf8');

console.log('Testing PapaParse with TSV file...');
console.log('First 100 chars:', tsvContent.substring(0, 100));

const result = Papa.parse(tsvContent, {
    delimiter: '', // Auto-detect
    header: true,
    skipEmptyLines: true
});

console.log('Detected delimiter:', JSON.stringify(result.meta.delimiter));
console.log('Headers:', result.meta.fields);
console.log('Row count:', result.data.length);
console.log('First row:', result.data[0]);
console.log('Errors:', result.errors);