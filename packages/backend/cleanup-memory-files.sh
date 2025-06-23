#!/bin/bash
# Script to clean up SQLite memory database files

echo "Starting cleanup of SQLite memory database files..."

# Count files before deletion
count_memory=$(ls -1 | grep -c "^:memory:" || echo 0)
count_file_memory=$(ls -1 | grep -c "^file::memory:" || echo 0)
total_count=$((count_memory + count_file_memory))

echo "Found $count_memory ':memory:*' files"
echo "Found $count_file_memory 'file::memory:*' files"
echo "Total: $total_count files to delete"

# Delete :memory:* files
echo "Deleting :memory:* files..."
for file in :memory:*; do
    if [ -f "$file" ]; then
        rm -f "$file"
    fi
done

# Delete file::memory:* files
echo "Deleting file::memory:* files..."
for file in file::memory:*; do
    if [ -f "$file" ]; then
        rm -f "$file"
    fi
done

# Verify deletion
count_memory_after=$(ls -1 | grep -c "^:memory:" || echo 0)
count_file_memory_after=$(ls -1 | grep -c "^file::memory:" || echo 0)
total_after=$((count_memory_after + count_file_memory_after))

echo "Cleanup complete!"
echo "Remaining ':memory:*' files: $count_memory_after"
echo "Remaining 'file::memory:*' files: $count_file_memory_after"
echo "Total remaining: $total_after"

if [ $total_after -eq 0 ]; then
    echo "✓ All SQLite memory database files have been successfully removed!"
else
    echo "⚠ Warning: Some files may still remain. Please check manually."
fi