#!/usr/bin/env python3
"""
Script to remove duplicate Pokemon entries from JSONL file.
Keeps only the first occurrence of each Pokemon name.
"""

import json
import sys
from pathlib import Path

def deduplicate_jsonl(input_file, output_file=None):
    """
    Remove duplicate Pokemon entries based on name, keeping only the first occurrence.
    
    Args:
        input_file: Path to input JSONL file
        output_file: Path to output JSONL file (optional, defaults to input_file.dedup)
    """
    input_path = Path(input_file)
    
    if output_file is None:
        output_path = input_path.with_suffix('.dedup' + input_path.suffix)
    else:
        output_path = Path(output_file)
    
    seen_names = set()
    unique_entries = []
    duplicates_found = []
    
    print(f"Reading from: {input_path}")
    
    with open(input_path, 'r', encoding='utf-8') as f:
        for line_num, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
                
            try:
                entry = json.loads(line)
                name = entry.get('name', '').strip()
                
                if name in seen_names:
                    duplicates_found.append({
                        'line': line_num,
                        'name': name,
                        'image': entry.get('image', ''),
                        'entry': entry
                    })
                    print(f"  Duplicate found: {name} (line {line_num}) - {entry.get('image', '')}")
                else:
                    seen_names.add(name)
                    unique_entries.append(entry)
                    
            except json.JSONDecodeError as e:
                print(f"  Warning: Invalid JSON on line {line_num}: {e}")
                continue
    
    # Write deduplicated file
    print(f"\nWriting deduplicated data to: {output_path}")
    with open(output_path, 'w', encoding='utf-8') as f:
        for entry in unique_entries:
            f.write(json.dumps(entry, ensure_ascii=False) + '\n')
    
    # Summary
    print(f"\nSummary:")
    print(f"  Original entries: {len(unique_entries) + len(duplicates_found)}")
    print(f"  Unique entries: {len(unique_entries)}")
    print(f"  Duplicates removed: {len(duplicates_found)}")
    
    if duplicates_found:
        print(f"\nDuplicates removed:")
        for dup in duplicates_found:
            print(f"  - {dup['name']} (line {dup['line']}) - {dup['image']}")
    
    return output_path, len(duplicates_found)

def main():
    if len(sys.argv) < 2:
        print("Usage: python deduplicate_pokemon.py <input_file> [output_file]")
        print("Example: python deduplicate_pokemon.py standard_all.jsonl standard_all_clean.jsonl")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else None
    
    if not Path(input_file).exists():
        print(f"Error: Input file '{input_file}' does not exist.")
        sys.exit(1)
    
    try:
        output_path, num_duplicates = deduplicate_jsonl(input_file, output_file)
        
        if num_duplicates > 0:
            print(f"\n✓ Deduplication complete! Clean file saved as: {output_path}")
            print(f"  You can now replace your original file or update your quiz to use the clean version.")
        else:
            print(f"\n✓ No duplicates found! Your file is already clean.")
            
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
