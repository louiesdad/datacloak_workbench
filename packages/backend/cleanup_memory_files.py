#!/usr/bin/env python3
import os
import glob

def cleanup_memory_files():
    # Get current directory
    current_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Count files before deletion
    memory_files = glob.glob(os.path.join(current_dir, ":memory:*"))
    file_memory_files = glob.glob(os.path.join(current_dir, "file::memory:*"))
    
    total_count = len(memory_files) + len(file_memory_files)
    
    print(f"Starting cleanup of SQLite memory database files...")
    print(f"Found {len(memory_files)} ':memory:*' files")
    print(f"Found {len(file_memory_files)} 'file::memory:*' files")
    print(f"Total: {total_count} files to delete")
    
    # Delete files
    deleted_count = 0
    
    print("\nDeleting :memory:* files...")
    for file in memory_files:
        try:
            os.remove(file)
            deleted_count += 1
        except Exception as e:
            print(f"Error deleting {file}: {e}")
    
    print("\nDeleting file::memory:* files...")
    for file in file_memory_files:
        try:
            os.remove(file)
            deleted_count += 1
        except Exception as e:
            print(f"Error deleting {file}: {e}")
    
    # Verify deletion
    memory_files_after = glob.glob(os.path.join(current_dir, ":memory:*"))
    file_memory_files_after = glob.glob(os.path.join(current_dir, "file::memory:*"))
    total_after = len(memory_files_after) + len(file_memory_files_after)
    
    print(f"\nCleanup complete!")
    print(f"Deleted {deleted_count} files")
    print(f"Remaining ':memory:*' files: {len(memory_files_after)}")
    print(f"Remaining 'file::memory:*' files: {len(file_memory_files_after)}")
    print(f"Total remaining: {total_after}")
    
    if total_after == 0:
        print("\n✓ All SQLite memory database files have been successfully removed!")
    else:
        print("\n⚠ Warning: Some files may still remain. Please check manually.")

if __name__ == "__main__":
    cleanup_memory_files()