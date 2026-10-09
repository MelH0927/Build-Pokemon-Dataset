#!/usr/bin/env python3
"""
Separate script to create the eval_other dataset with better debugging
"""

from datasets import Dataset, load_from_disk, DatasetDict
import random
from collections import defaultdict
import json

class EvalOtherCreator:
    def __init__(self):
        self.type_order = [
            'Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice',
            'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug',
            'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy'
        ]
        random.seed(42)  # For reproducible results
    
    def load_training_names(self, training_dataset_path):
        """Load the names of Pokemon in the training dataset"""
        print(f"Loading training dataset from {training_dataset_path}...")
        train_dataset = load_from_disk(training_dataset_path)
        train_names = set(entry['name'] for entry in train_dataset)
        print(f"✓ Found {len(train_names)} unique Pokemon names in training set")
        return train_names
    
    def analyze_dataset(self, dataset_path):
        """Analyze the full dataset"""
        print(f"\nAnalyzing dataset from {dataset_path}...")
        dataset = load_from_disk(dataset_path)
        
        print(f"✓ Total entries: {len(dataset)}")
        
        # Art style distribution
        art_style_counts = defaultdict(int)
        for entry in dataset:
            art_style_counts[entry['art_style']] += 1
        
        print(f"\n📊 Art style distribution:")
        for art_style, count in sorted(art_style_counts.items()):
            print(f"  {art_style}: {count}")
        
        # Type distribution for non-standard art styles
        non_standard_entries = [entry for entry in dataset if entry['art_style'] != 'standard']
        type_counts = defaultdict(int)
        for entry in non_standard_entries:
            type_counts[entry['primary_type']] += 1
        
        print(f"\n📊 Non-standard entries by primary type ({len(non_standard_entries)} total):")
        for type_name in self.type_order:
            if type_name in type_counts:
                print(f"  {type_name}: {type_counts[type_name]}")
        
        return dataset, non_standard_entries
    
    def filter_out_training_pokemon(self, entries, train_names):
        """Filter out Pokemon that are in the training set"""
        filtered_entries = entries.copy()
        #excluded_count = 0
        
        #for entry in entries:
        #    if entry['name'] not in train_names:
        #        filtered_entries.append(entry)
        #    else:
        #        excluded_count += 1
        
        #print(f"✓ Filtered out {excluded_count} entries that are in training set")
        #print(f"✓ Remaining entries: {len(filtered_entries)}")
        
        return filtered_entries
    
    def sample_test_set(self, entries, samples_per_type=8):
        """Sample test set from entries with Flying type fallback"""
        print(f"\nSampling test set ({samples_per_type} per type)...")
        
        # Group by primary type
        type_groups = defaultdict(list)
        flying_dual_type_entries = []
        
        for entry in entries:
            primary_type = entry['primary_type']
            secondary_type = entry['secondary_type']
            
            # Regular grouping by primary type
            type_groups[primary_type].append(entry)
            
            # Collect Flying dual-type entries for fallback
            if secondary_type == 'Flying':
                flying_dual_type_entries.append(entry)
        
        print(f"\n📊 Available entries by type:")
        for type_name in self.type_order:
            count = len(type_groups.get(type_name, []))
            print(f"  {type_name}: {count}")
        
        print(f"  Flying (secondary): {len(flying_dual_type_entries)}")
        
        test_entries = []
        for type_name in self.type_order:
            if type_name not in type_groups:
                print(f"⚠️  No {type_name} type Pokemon found for eval")
                continue
            
            candidates = type_groups[type_name]
            
            # Special handling for Flying type
            if type_name == 'Flying':
                # Prioritize single-type Flying Pokemon
                single_flying = [entry for entry in candidates if entry['secondary_type'] is None]
                dual_flying_primary = [entry for entry in candidates if entry['secondary_type'] is not None]
                
                print(f"    Flying breakdown: {len(single_flying)} single-type, {len(dual_flying_primary)} dual-type (primary)")
                
                random.shuffle(single_flying)
                selected = single_flying[:samples_per_type]
                
                # If we need more, use dual-type entries with primary_type == 'Flying'
                if len(selected) < samples_per_type:
                    needed = samples_per_type - len(selected)
                    print(f"    Need {needed} more, using dual-type (primary Flying)")
                    
                    random.shuffle(dual_flying_primary)
                    selected.extend(dual_flying_primary[:needed])
                
                # If still need more, use dual-type entries with secondary_type == 'Flying'
                if len(selected) < samples_per_type:
                    needed = samples_per_type - len(selected)
                    print(f"    Still need {needed} more, using dual-type (secondary Flying)")
                    
                    available_flying_dual = [entry for entry in flying_dual_type_entries 
                                           if entry not in selected]
                    random.shuffle(available_flying_dual)
                    selected.extend(available_flying_dual[:needed])
            else:
                # Regular sampling for other types
                random.shuffle(candidates)
                selected = candidates[:samples_per_type]
            
            test_entries.extend(selected)
            print(f"    ✓ Selected {len(selected)} {type_name} type Pokemon")
            
            if len(selected) < samples_per_type:
                print(f"    ⚠️  Could only find {len(selected)} {type_name} Pokemon (needed {samples_per_type})")
        
        return test_entries
    
    def create_other_eval_dataset(self, full_dataset_path, training_dataset_path, output_path="other_eval_dataset"):
        """Create the other_eval dataset"""
        print("🚀 Creating other_eval dataset")
        print("=" * 50)
        
        # Load training names
        train_names = self.load_training_names(training_dataset_path)
        
        # Analyze full dataset
        full_dataset, non_standard_entries = self.analyze_dataset(full_dataset_path)
        
        # Filter out training Pokemon
        other_entries = self.filter_out_training_pokemon(non_standard_entries, train_names)
        
        # Sample test set
        other_test = self.sample_test_set(other_entries, samples_per_type=8)
        
        # Create the DatasetDict
        print(f"\n📊 Creating DatasetDict...")
        other_eval = DatasetDict({
            'test': Dataset.from_dict({
                'image': [entry['image'] for entry in other_test],
                'primary_type': [entry['primary_type'] for entry in other_test],
                'secondary_type': [entry['secondary_type'] for entry in other_test],
                'art_style': [entry['art_style'] for entry in other_test],
                'name': [entry['name'] for entry in other_test],
                'number': [entry['number'] for entry in other_test],
                'paradox_or_ultrabeast': [entry.get('paradox_or_ultrabeast', 'no') for entry in other_test]
            }),
            'streaming': Dataset.from_dict({
                'image': [entry['image'] for entry in other_entries],
                'primary_type': [entry['primary_type'] for entry in other_entries],
                'secondary_type': [entry['secondary_type'] for entry in other_entries],
                'art_style': [entry['art_style'] for entry in other_entries],
                'name': [entry['name'] for entry in other_entries],
                'number': [entry['number'] for entry in other_entries],
                'paradox_or_ultrabeast': [entry.get('paradox_or_ultrabeast', 'no') for entry in other_entries]
            })
        })
        
        # Save the dataset
        other_eval.save_to_disk(output_path)
        print(f"✓ Saved other_eval dataset to {output_path}")
        print(f"  Test split: {len(other_test)} entries")
        print(f"  Streaming split: {len(other_entries)} entries")
        
        # Final summary
        print(f"\n🎉 other_eval dataset created successfully!")
        print(f"\n📋 Summary:")
        print(f"  Dataset path: {output_path}")
        print(f"  Test entries: {len(other_test)}")
        print(f"  Streaming entries: {len(other_entries)}")
        
        # Test set type distribution
        test_type_counts = defaultdict(int)
        for entry in other_test:
            test_type_counts[entry['primary_type']] += 1
        
        print(f"\n📊 Test set type distribution:")
        for type_name in self.type_order:
            if type_name in test_type_counts:
                print(f"  {type_name}: {test_type_counts[type_name]}")
        
        return other_eval

def main():
    creator = EvalOtherCreator()
    
    # Dataset paths
    full_dataset_path = "pokemon_dataset_with_paradox_updated"
    training_dataset_path = "IVL_CLS_pokemon_8_shot"  # Use 8-shot as reference
    output_path = "other_eval_dataset"
    
    # Create the dataset
    other_eval = creator.create_other_eval_dataset(
        full_dataset_path=full_dataset_path,
        training_dataset_path=training_dataset_path,
        output_path=output_path
    )

if __name__ == "__main__":
    main()