const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const backendDir = __dirname;

console.log('Starting forceful cleanup of SQLite memory database files...');
console.log('Directory:', backendDir);

try {
    // First, let's get a count of these files
    const allFiles = fs.readdirSync(backendDir);
    const memoryFiles = allFiles.filter(file => 
        file.startsWith(':memory:') || file.startsWith('file::memory:')
    );
    
    console.log(`Found ${memoryFiles.length} SQLite memory database files`);
    
    if (memoryFiles.length === 0) {
        console.log('No memory database files found. Directory is clean!');
        process.exit(0);
    }
    
    // Create a temporary shell script to handle the deletion
    const scriptContent = `#!/bin/bash
cd "${backendDir}"
echo "Deleting :memory:* files..."
for file in :memory:*; do
    if [ -f "$file" ]; then
        rm -f "$file" 2>/dev/null || echo "Failed to delete: $file"
    fi
done

echo "Deleting file::memory:* files..."
for file in file::memory:*; do
    if [ -f "$file" ]; then
        rm -f "$file" 2>/dev/null || echo "Failed to delete: $file"
    fi
done
`;
    
    const scriptPath = path.join(backendDir, 'temp_cleanup.sh');
    fs.writeFileSync(scriptPath, scriptContent, { mode: 0o755 });
    
    console.log('\nExecuting cleanup...');
    
    try {
        // Execute the shell script
        execSync(`bash "${scriptPath}"`, { stdio: 'inherit' });
    } catch (shellError) {
        console.error('Shell execution error:', shellError.message);
        
        // Fallback: Try to delete files one by one with Node.js
        console.log('\nFalling back to Node.js deletion...');
        let deleted = 0;
        let failed = 0;
        
        for (const file of memoryFiles) {
            try {
                const filePath = path.join(backendDir, file);
                // Use unlinkSync with force option
                fs.unlinkSync(filePath);
                deleted++;
            } catch (err) {
                console.error(`Failed to delete ${file}:`, err.message);
                failed++;
            }
        }
        
        console.log(`\nDeleted: ${deleted} files`);
        console.log(`Failed: ${failed} files`);
    }
    
    // Clean up the temporary script
    try {
        fs.unlinkSync(scriptPath);
    } catch (e) {
        // Ignore cleanup errors
    }
    
    // Verify the results
    console.log('\nVerifying cleanup...');
    const remainingFiles = fs.readdirSync(backendDir).filter(file => 
        file.startsWith(':memory:') || file.startsWith('file::memory:')
    );
    
    console.log(`Remaining memory database files: ${remainingFiles.length}`);
    
    if (remainingFiles.length === 0) {
        console.log('\n✓ SUCCESS: All SQLite memory database files have been removed!');
    } else {
        console.log('\n⚠ WARNING: Some files could not be deleted:');
        remainingFiles.slice(0, 10).forEach(file => console.log(`  - ${file}`));
        if (remainingFiles.length > 10) {
            console.log(`  ... and ${remainingFiles.length - 10} more`);
        }
        
        console.log('\nThese files may be locked by running processes.');
        console.log('Please stop any Node.js processes using these databases and try again.');
    }
    
} catch (error) {
    console.error('Error during cleanup:', error);
    process.exit(1);
}