#!/usr/bin/env python3
"""
Script to add new Pokemon entries to the existing dataset
"""

import requests
import io
from PIL import Image
from datasets import Dataset, load_from_disk, concatenate_datasets
import os

class PokemonDatasetUpdater:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        })
    
    def download_image(self, img_url, target_size=(384, 384)):
        """Download image and return as PIL Image, resized to standard size"""
        try:
            print(f"Downloading image from: {img_url}")
            response = self.session.get(img_url, timeout=15)
            response.raise_for_status()
            
            image = Image.open(io.BytesIO(response.content))
            
            # Convert to RGB if necessary
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            # Resize while maintaining aspect ratio
            image.thumbnail(target_size, Image.Resampling.LANCZOS)
            
            # Create a new image with the target size and paste the resized image
            new_image = Image.new('RGB', target_size, (255, 255, 255))  # White background
            
            # Center the image
            x = (target_size[0] - image.size[0]) // 2
            y = (target_size[1] - image.size[1]) // 2
            new_image.paste(image, (x, y))
            
            print(f"✓ Successfully downloaded and processed image")
            return new_image
            
        except Exception as e:
            print(f"✗ Failed to download image {img_url}: {e}")
            return None
    
    def add_pokemon_entries(self, dataset_path, new_entries, output_path=None):
        """Add new Pokemon entries to the existing dataset"""
        
        # Load existing dataset
        print(f"Loading existing dataset from: {dataset_path}")
        try:
            existing_dataset = load_from_disk(dataset_path)
            print(f"✓ Loaded dataset with {len(existing_dataset)} entries")
        except Exception as e:
            print(f"✗ Failed to load dataset: {e}")
            return False
        
        # Prepare new entries
        new_data = {
            'image': [],
            'primary_type': [],
            'secondary_type': [],
            'art_style': [],
            'name': [],
            'number': [],
            'paradox_or_ultrabeast': []
        }
        
        for entry in new_entries:
            print(f"\nProcessing: {entry['name']} (#{entry['number']})")
            
            # Download image
            image = self.download_image(entry['image_url'])
            if image is None:
                print(f"✗ Skipping {entry['name']} due to image download failure")
                continue
            
            # Add to new data
            new_data['image'].append(image)
            new_data['primary_type'].append(entry['primary_type'])
            new_data['secondary_type'].append(entry['secondary_type'])
            new_data['art_style'].append(entry['art_style'])
            new_data['name'].append(entry['name'])
            new_data['number'].append(entry['number'])
            new_data['paradox_or_ultrabeast'].append(entry['paradox_or_ultrabeast'])
            
            print(f"✓ Added {entry['name']} to new entries")
        
        if not new_data['image']:
            print("✗ No new entries to add (all downloads failed)")
            return False
        
        # Create dataset from new data
        print(f"\nCreating dataset from {len(new_data['image'])} new entries...")
        new_dataset = Dataset.from_dict(new_data)
        
        # Concatenate with existing dataset
        print("Concatenating with existing dataset...")
        combined_dataset = concatenate_datasets([existing_dataset, new_dataset])
        
        print(f"✓ Combined dataset now has {len(combined_dataset)} entries")
        
        # Save the updated dataset
        if output_path is None:
            output_path = dataset_path + "_updated"
        
        print(f"Saving updated dataset to: {output_path}")
        combined_dataset.save_to_disk(output_path)
        print(f"✓ Dataset saved successfully!")
        
        # Print summary
        print(f"\n=== Summary ===")
        print(f"Original entries: {len(existing_dataset)}")
        print(f"New entries added: {len(new_data['image'])}")
        print(f"Total entries: {len(combined_dataset)}")
        print(f"Output location: {output_path}")
        
        return True

def main():
    # Define the new Pokemon entries
    new_pokemon_entries = [
        {
            'image_url': 'https://img.pokemondb.net/sprites/scarlet-violet/normal/sinistcha.png',
            'primary_type': 'Grass',
            'secondary_type': 'Ghost',
            'art_style': 'standard',
            'name': 'Sinistcha',
            'number': '1013',
            'paradox_or_ultrabeast': 'no'
        },
        {
            'image_url': 'https://img.pokemondb.net/sprites/scarlet-violet/normal/hydrapple.png',
            'primary_type': 'Grass',
            'secondary_type': 'Dragon',
            'art_style': 'standard',
            'name': 'Hydrapple',
            'number': '1019',
            'paradox_or_ultrabeast': 'no'
        },
        {
            'image_url': 'https://img.pokemondb.net/sprites/scarlet-violet/normal/gouging-fire.png',
            'primary_type': 'Fire',
            'secondary_type': 'Dragon',
            'art_style': 'standard',
            'name': 'Gouging Fire',
            'number': '1020',
            'paradox_or_ultrabeast': 'yes'
        },
        {
            'image_url': 'https://img.pokemondb.net/sprites/scarlet-violet/normal/iron-boulder.png',
            'primary_type': 'Rock',
            'secondary_type': 'Psychic',
            'art_style': 'standard',
            'name': 'Iron Boulder',
            'number': '1022',
            'paradox_or_ultrabeast': 'yes'
        }
    ]
    
    # Initialize updater
    updater = PokemonDatasetUpdater()
    
    # Dataset paths
    input_dataset_path = "pokemon_dataset_with_paradox"
    output_dataset_path = "pokemon_dataset_with_paradox_updated"
    
    print("=== Pokemon Dataset Updater ===")
    print(f"Adding {len(new_pokemon_entries)} new Pokemon entries...")
    
    # Add new entries
    success = updater.add_pokemon_entries(
        dataset_path=input_dataset_path,
        new_entries=new_pokemon_entries,
        output_path=output_dataset_path
    )
    
    if success:
        print("\n🎉 Successfully updated the Pokemon dataset!")
        print(f"📁 Updated dataset saved to: {output_dataset_path}")
        print("\n📋 New Pokemon added:")
        for entry in new_pokemon_entries:
            status = "🔥 Paradox" if entry['paradox_or_ultrabeast'] == 'yes' else "⭐ Regular"
            print(f"  • #{entry['number']} {entry['name']} ({entry['primary_type']}/{entry['secondary_type']}) - {status}")
    else:
        print("\n❌ Failed to update the dataset")

if __name__ == "__main__":
    # Required packages: pip install requests pillow datasets
    main()
