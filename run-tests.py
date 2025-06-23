#!/usr/bin/env python3
import subprocess
import os
import sys

def run_command(cmd, cwd):
    """Run a command and print output"""
    print(f"\n{'='*60}")
    print(f"Running: {cmd}")
    print(f"In: {cwd}")
    print('='*60)
    
    try:
        result = subprocess.run(
            cmd, 
            shell=True, 
            cwd=cwd, 
            capture_output=True, 
            text=True
        )
        
        print(result.stdout)
        if result.stderr:
            print("STDERR:", result.stderr)
        
        return result.returncode
    except Exception as e:
        print(f"Error running command: {e}")
        return 1

def main():
    base_dir = "/Users/thomaswagner/Documents/datacloak-sentiment-workbench"
    
    print("DataCloak Test Runner")
    print("====================")
    
    # Run backend tests
    print("\n\n### BACKEND UNIT TESTS ###")
    backend_dir = os.path.join(base_dir, "packages", "backend")
    if os.path.exists(backend_dir):
        run_command("npm test", backend_dir)
    else:
        print(f"Backend directory not found: {backend_dir}")
    
    # Run frontend tests
    print("\n\n### FRONTEND UNIT TESTS ###")
    frontend_dir = os.path.join(base_dir, "packages", "web-ui")
    if os.path.exists(frontend_dir):
        run_command("npm test", frontend_dir)
    else:
        print(f"Frontend directory not found: {frontend_dir}")
    
    # Run E2E tests
    print("\n\n### E2E TESTS ###")
    e2e_dir = os.path.join(base_dir, "tests", "e2e")
    if os.path.exists(e2e_dir):
        run_command("npm test", e2e_dir)
    else:
        print(f"E2E directory not found: {e2e_dir}")

if __name__ == "__main__":
    main()