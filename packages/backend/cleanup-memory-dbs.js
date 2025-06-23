const fs = require('fs');
const path = require('path');

const backendDir = __dirname;

// Get all files in the directory
const files = fs.readdirSync(backendDir);

// Filter for memory database files
const memoryFiles = files.filter(file => 
    file.startsWith(':memory:') || file.startsWith('file::memory:')
);

console.log(`Found ${memoryFiles.length} SQLite memory database files to delete`);

let deletedCount = 0;
let errorCount = 0;

// Delete each file
memoryFiles.forEach(file => {
    try {
        const filePath = path.join(backendDir, file);
        fs.unlinkSync(filePath);
        deletedCount++;
    } catch (error) {
        console.error(`Error deleting ${file}: ${error.message}`);
        errorCount++;
    }
});

console.log(`\nCleanup complete!`);
console.log(`Successfully deleted: ${deletedCount} files`);
console.log(`Errors: ${errorCount}`);

// Verify deletion
const filesAfter = fs.readdirSync(backendDir);
const remainingMemoryFiles = filesAfter.filter(file => 
    file.startsWith(':memory:') || file.startsWith('file::memory:')
);

console.log(`\nRemaining memory database files: ${remainingMemoryFiles.length}`);

if (remainingMemoryFiles.length === 0) {
    console.log('✓ All SQLite memory database files have been successfully removed!');
} else {
    console.log('⚠ Warning: Some files still remain:');
    remainingMemoryFiles.slice(0, 10).forEach(file => console.log(`  - ${file}`));
    if (remainingMemoryFiles.length > 10) {
        console.log(`  ... and ${remainingMemoryFiles.length - 10} more`);
    }
}