#!/usr/bin/env ts-node

/**
 * Script to clean up orphaned uploaded files
 * Run with: npx ts-node src/scripts/cleanup-orphaned-files.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import Database from 'better-sqlite3';

async function cleanupOrphanedFiles() {
  const uploadDir = path.join(process.cwd(), 'data', 'uploads');
  
  if (!fs.existsSync(uploadDir)) {
    console.log('Upload directory does not exist');
    return;
  }

  console.log(`Scanning upload directory: ${uploadDir}`);
  
  // Get all files in upload directory
  const files = fs.readdirSync(uploadDir);
  console.log(`Found ${files.length} files in upload directory`);
  
  // Get all dataset filenames from database
  const dbFilenames = new Set<string>();
  
  const dbPath = path.join(process.cwd(), 'data', 'sqlite.db');
  const db = new Database(dbPath);
  
  try {
    const stmt = db.prepare('SELECT filename FROM datasets');
    const datasets = stmt.all() as { filename: string }[];
    
    datasets.forEach(dataset => {
      if (dataset.filename) {
        dbFilenames.add(dataset.filename);
      }
    });
  } finally {
    db.close();
  }
  
  console.log(`Found ${dbFilenames.size} datasets in database`);
  
  // Find orphaned files
  const orphanedFiles: string[] = [];
  let totalSize = 0;
  
  for (const file of files) {
    if (!dbFilenames.has(file)) {
      orphanedFiles.push(file);
      const filePath = path.join(uploadDir, file);
      const stats = fs.statSync(filePath);
      totalSize += stats.size;
    }
  }
  
  console.log(`\nFound ${orphanedFiles.length} orphaned files`);
  console.log(`Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
  
  if (orphanedFiles.length === 0) {
    console.log('No orphaned files to clean up');
    return;
  }
  
  // List orphaned files
  console.log('\nOrphaned files:');
  orphanedFiles.forEach(file => {
    const filePath = path.join(uploadDir, file);
    const stats = fs.statSync(filePath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    const age = Math.floor((Date.now() - stats.mtimeMs) / 1000 / 60 / 60 / 24);
    console.log(`  - ${file} (${sizeMB} MB, ${age} days old)`);
  });
  
  // Ask for confirmation
  console.log('\nDo you want to delete these files? (yes/no)');
  
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  rl.question('> ', (answer: string) => {
    if (answer.toLowerCase() === 'yes') {
      console.log('\nDeleting orphaned files...');
      
      let deleted = 0;
      for (const file of orphanedFiles) {
        try {
          const filePath = path.join(uploadDir, file);
          fs.unlinkSync(filePath);
          deleted++;
        } catch (error) {
          console.error(`Failed to delete ${file}:`, error);
        }
      }
      
      console.log(`Deleted ${deleted} files`);
      console.log(`Freed ${(totalSize / 1024 / 1024).toFixed(2)} MB of disk space`);
    } else {
      console.log('Cleanup cancelled');
    }
    
    rl.close();
    process.exit(0);
  });
}

// Run the cleanup
cleanupOrphanedFiles().catch(error => {
  console.error('Cleanup failed:', error);
  process.exit(1);
});