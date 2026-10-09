#!/usr/bin/env python3
"""
Upload existing Pokemon dataset to HuggingFace Hub

This script loads an already-built Pokemon dataset from disk and uploads it to HuggingFace Hub.
No need to rebuild the dataset - just upload what you already have!
"""

import os
import argparse
from datasets import Dataset, DatasetDict, load_from_disk
from huggingface_hub import HfApi

def upload_pokemon_dataset(dataset_path, repo_name):
    """Load existing dataset and upload to HuggingFace"""
    
    # Get token from environment variable (recommended for security)
    HF_TOKEN = os.getenv("HF_TOKEN")
    
    if not HF_TOKEN:
        print("❌ Error: HF_TOKEN environment variable not set!")
        print("Please set it with: export HF_TOKEN='your_huggingface_token_here'")
        print("Get your token from: https://huggingface.co/settings/tokens")
        return False
    
    # Check if dataset exists
    if not os.path.exists(dataset_path):
        print(f"❌ Error: Dataset not found at {dataset_path}")
        print("Make sure you've run builder.py first to create the dataset")
        return False
    
    try:
        print(f"📁 Loading dataset from {dataset_path}...")
        dataset = load_from_disk(dataset_path)
        
        print(f"✅ Dataset loaded successfully!")
        
        # Check if it's a single dataset or a dataset with splits
        if isinstance(dataset, DatasetDict):
            print(f"   - Dataset type: DatasetDict with splits")
            total_entries = sum(len(split_data) for split_data in dataset.values())
            print(f"   - Total entries across all splits: {total_entries}")
            print(f"   - Splits: {list(dataset.keys())}")
            for split_name, split_data in dataset.items():
                print(f"     • {split_name}: {len(split_data)} entries")
            print(f"   - Features: {list(next(iter(dataset.values())).features.keys())}")
        else:
            print(f"   - Dataset type: Single Dataset")
            print(f"   - Total entries: {len(dataset)}")
            print(f"   - Features: {list(dataset.features.keys())}")
        
        print(f"\n🚀 Uploading to HuggingFace: {repo_name}")
        print("This may take a while for large datasets...")
        
        # Upload to HuggingFace
        dataset.push_to_hub(repo_name, token=HF_TOKEN)
        
        print(f"✅ Successfully uploaded to HuggingFace!")
        print(f"🔗 View your dataset at: https://huggingface.co/datasets/{repo_name}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error uploading dataset: {e}")
        print("\nCommon issues:")
        print("1. Invalid HuggingFace token")
        print("2. Repository name format should be 'username/repo-name'")
        print("3. Network connectivity issues")
        print("4. Insufficient storage quota on HuggingFace")
        return False

def parse_arguments():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(
        description="Upload Pokemon dataset to HuggingFace Hub",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Upload single dataset (training sets)
  python upload_to_huggingface.py --dataset-path ./IVL_CLS_pokemon_8_shot --repo-name andyqmongo/IVL_CLS_pokemon_8_shot
  
  # Upload dataset with splits (evaluation sets)
  python upload_to_huggingface.py -d ./standard_eval_dataset -r andyqmongo/pokemon_eval_standard
  python upload_to_huggingface.py -d ./other_eval_dataset -r andyqmongo/pokemon_eval_other
        """
    )
    
    parser.add_argument(
        '--dataset-path', '-d',
        type=str,
        required=True,
        help="Path to the dataset directory to upload"
    )
    
    parser.add_argument(
        '--repo-name', '-r',
        type=str,
        required=True,
        help="HuggingFace repository name (format: username/repo-name)"
    )
    
    return parser.parse_args()

def main():
    print("=== Pokemon Dataset Uploader ===")
    print("This script uploads your existing Pokemon dataset to HuggingFace Hub\n")
    
    # Parse command line arguments
    args = parse_arguments()
    
    # Instructions for first-time users
    print("📋 Before running this script:")
    print("1. Get your HuggingFace token from: https://huggingface.co/settings/tokens")
    print("2. Set it as environment variable: export HF_TOKEN='your_token_here'")
    print("3. Make sure your dataset exists in the specified path\n")
    
    print(f"📁 Dataset path: {args.dataset_path}")
    print(f"🚀 Repository name: {args.repo_name}\n")
    
    success = upload_pokemon_dataset(args.dataset_path, args.repo_name)
    
    if success:
        print("\n🎉 Upload completed successfully!")
    else:
        print("\n💡 Fix the issues above and try again")

if __name__ == "__main__":
    # Required packages (should already be installed from builder.py):
    # pip install datasets huggingface_hub
    
    main()
