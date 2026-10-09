#!/usr/bin/env python3
"""
Script to remove lines containing "Skipping duplicate number..." from the log file
"""

import sys
import os

def clean_log_file(input_file, output_file=None):
    """Remove lines containing 'Skipping duplicate number...' from the log file"""
    
    if not os.path.exists(input_file):
        print(f"Error: File {input_file} does not exist")
        return False
    
    # If no output file specified, overwrite the original
    if output_file is None:
        output_file = input_file
        # Create backup first
        backup_file = input_file + ".backup"
        print(f"Creating backup: {backup_file}")
        with open(input_file, 'r', encoding='utf-8') as f:
            content = f.read()
        with open(backup_file, 'w', encoding='utf-8') as f:
            f.write(content)
    
    lines_removed = 0
    total_lines = 0
    
    try:
        with open(input_file, 'r', encoding='utf-8') as infile:
            lines = infile.readlines()
        
        # Filter out lines containing "Skipping duplicate number"
        filtered_lines = []
        for line in lines:
            total_lines += 1
            if "Skipping duplicate" in line:
                lines_removed += 1
                print(f"Removing line: {line.strip()}")
            else:
                filtered_lines.append(line)
        
        # Write cleaned content
        with open(output_file, 'w', encoding='utf-8') as outfile:
            outfile.writelines(filtered_lines)
        
        print(f"\nCleaning complete!")
        print(f"Total lines processed: {total_lines}")
        print(f"Lines removed: {lines_removed}")
        print(f"Lines remaining: {len(filtered_lines)}")
        print(f"Output written to: {output_file}")
        
        return True
        
    except Exception as e:
        print(f"Error processing file: {e}")
        return False

def main():
    # Default input file
    input_file = "output_backup.log"
    output_file = None
    
    # Parse command line arguments
    if len(sys.argv) > 1:
        input_file = sys.argv[1]
    if len(sys.argv) > 2:
        output_file = sys.argv[2]
    
    print(f"Cleaning log file: {input_file}")
    if output_file:
        print(f"Output file: {output_file}")
    else:
        print("Will overwrite original file (backup will be created)")
    
    success = clean_log_file(input_file, output_file)
    
    if success:
        print("\n✓ Log file cleaned successfully!")
    else:
        print("\n✗ Failed to clean log file")
        sys.exit(1)

if __name__ == "__main__":
    main()
