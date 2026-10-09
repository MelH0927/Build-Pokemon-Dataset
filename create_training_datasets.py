#!/usr/bin/env python3
"""
Script to create training and evaluation datasets from the updated Pokemon dataset
"""

import requests
from bs4 import BeautifulSoup
import re
from datasets import Dataset, load_from_disk, DatasetDict
import random
from collections import defaultdict
import json
import os

class PokemonDatasetCreator:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        })
        self.evolution_chains = {}
        self.type_order = [
            'Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice',
            'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug',
            'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy'
        ]
        random.seed(42)  # For reproducible results
    
    def fetch_evolution_chains(self):
        """Fetch evolution chains from pokemondb.net/evolution"""
        print("Fetching evolution chains...")
        url = "https://pokemondb.net/evolution"
        
        try:
            response = self.session.get(url, timeout=15)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Find all evolution chains
            evolution_sections = soup.find_all('div', class_='infocard-list-evo')
            
            chain_id = 0
            for section in evolution_sections:
                chain_id += 1
                pokemon_in_chain = []
                
                # Extract Pokemon names from this evolution chain
                pokemon_links = section.find_all('a', class_='ent-name')
                for link in pokemon_links:
                    pokemon_name = link.get_text().strip()
                    pokemon_in_chain.append(pokemon_name)
                
                # Store each Pokemon with its chain ID
                for pokemon in pokemon_in_chain:
                    self.evolution_chains[pokemon] = {
                        'chain_id': chain_id,
                        'chain_members': pokemon_in_chain.copy()
                    }
            
            print(f"✓ Loaded {len(self.evolution_chains)} Pokemon evolution relationships")
            print(f"✓ Found {chain_id} evolution chains")
            
        except Exception as e:
            print(f"✗ Error fetching evolution chains: {e}")
            print("Continuing without evolution chain filtering...")
    
    def pokemon_in_same_chain(self, pokemon1, pokemon2):
        """Check if two Pokemon are in the same evolution chain"""
        if pokemon1 not in self.evolution_chains or pokemon2 not in self.evolution_chains:
            return False
        return self.evolution_chains[pokemon1]['chain_id'] == self.evolution_chains[pokemon2]['chain_id']
    
    def filter_single_type_pokemon(self, dataset):
        """Filter Pokemon to include only single-type and specific dual-type combinations"""
        filtered_entries = []
        
        for entry in dataset:
            # Single type (secondary_type is None)
            if entry['secondary_type'] is None:
                filtered_entries.append(entry)
            # Normal/Flying combination (keep original types)
            elif ((entry['primary_type'] == 'Normal' and entry['secondary_type'] == 'Flying') or
                  (entry['primary_type'] == 'Flying' and entry['secondary_type'] == 'Normal')):
                filtered_entries.append(entry)
            # Steel/Rock combination (keep original types)
            elif ((entry['primary_type'] == 'Steel' and entry['secondary_type'] == 'Rock') or
                  (entry['primary_type'] == 'Rock' and entry['secondary_type'] == 'Steel')):
                filtered_entries.append(entry)
        
        print(f"✓ Filtered to {len(filtered_entries)} single-type and specific dual-type Pokemon entries")
        return filtered_entries
    
    def group_by_type(self, entries):
        """Group Pokemon entries by their effective primary type"""
        type_groups = defaultdict(list)
        
        for entry in entries:
            # Skip if not standard art style
            if entry['art_style'] != 'standard':
                continue
            # Skip if paradox or ultra beast
            if entry.get('paradox_or_ultrabeast', 'no') == 'yes':
                continue
            
            # Determine the effective type for grouping
            primary_type = entry['primary_type']
            secondary_type = entry['secondary_type']
            
            # For Flying type: include Normal/Flying and Flying/Normal
            if ((primary_type == 'Normal' and secondary_type == 'Flying') or
                (primary_type == 'Flying' and secondary_type == 'Normal')):
                type_groups['Flying'].append(entry)
            # For Steel type: include Steel/Rock and Rock/Steel  
            elif ((primary_type == 'Steel' and secondary_type == 'Rock') or
                  (primary_type == 'Rock' and secondary_type == 'Steel')):
                type_groups['Steel'].append(entry)
            # Single type Pokemon
            elif secondary_type is None:
                type_groups[primary_type].append(entry)
        
        return type_groups
    
    def sample_training_set(self, type_groups, shots_per_type=8):
        """Sample training set with priority for single types and fallback to dual types"""
        training_entries = []
        selected_chains = set()
        
        for type_name in self.type_order:
            if type_name not in type_groups:
                print(f"⚠️  No {type_name} type Pokemon found")
                continue
            
            candidates = type_groups[type_name].copy()
            random.shuffle(candidates)
            
            type_selections = []
            
            # Step 1: Prioritize single-type Pokemon
            single_type_candidates = [entry for entry in candidates if entry['secondary_type'] is None]
            dual_type_candidates = [entry for entry in candidates if entry['secondary_type'] is not None]
            
            print(f"  {type_name}: {len(single_type_candidates)} single-type, {len(dual_type_candidates)} dual-type")
            
            # Special handling for Flying type - must include Tornadus and Rookidee/Corvisquire
            if type_name == 'Flying':
                required_pokemon = ['Tornadus']
                rookidee_line = ['Rookidee', 'Corvisquire']
                
                # Add Tornadus if available
                for entry in single_type_candidates:
                    if entry['name'] == 'Tornadus':
                        type_selections.append(entry)
                        if entry['name'] in self.evolution_chains:
                            selected_chains.add(self.evolution_chains[entry['name']]['chain_id'])
                        break
                
                # Add one from Rookidee line if available
                for pokemon_name in rookidee_line:
                    for entry in single_type_candidates:
                        if entry['name'] == pokemon_name:
                            type_selections.append(entry)
                            if entry['name'] in self.evolution_chains:
                                selected_chains.add(self.evolution_chains[entry['name']]['chain_id'])
                            break
                    if len(type_selections) == 2:  # Found one from Rookidee line
                        break
            
            # Step 2: Sample remaining single-type Pokemon first
            for entry in single_type_candidates:
                if len(type_selections) >= shots_per_type:
                    break
                
                # Skip if already selected
                if entry in type_selections:
                    continue
                
                # Check evolution chain conflict
                entry_name = entry['name']
                if entry_name in self.evolution_chains:
                    chain_id = self.evolution_chains[entry_name]['chain_id']
                    if chain_id in selected_chains:
                        continue
                    selected_chains.add(chain_id)
                
                type_selections.append(entry)
            
            # Step 3: If we need more, use dual-type Pokemon
            if len(type_selections) < shots_per_type:
                print(f"    Need {shots_per_type - len(type_selections)} more, using dual-type Pokemon")
                for entry in dual_type_candidates:
                    if len(type_selections) >= shots_per_type:
                        break
                    
                    # Skip if already selected
                    if entry in type_selections:
                        continue
                    
                    # Check evolution chain conflict
                    entry_name = entry['name']
                    if entry_name in self.evolution_chains:
                        chain_id = self.evolution_chains[entry_name]['chain_id']
                        if chain_id in selected_chains:
                            continue
                        selected_chains.add(chain_id)
                    
                    type_selections.append(entry)
            
            print(f"✓ Selected {len(type_selections)} {type_name} type Pokemon for {shots_per_type}-shot")
            if len(type_selections) < shots_per_type:
                print(f"⚠️  Could only find {len(type_selections)} {type_name} Pokemon (needed {shots_per_type})")
            
            training_entries.extend(type_selections)
        
        return training_entries
    
    def create_n_shot_datasets(self, full_dataset_path, output_base_name):
        """Create 1-shot, 2-shot, 4-shot, and 8-shot training datasets"""
        print(f"\n=== Creating training datasets from {full_dataset_path} ===")
        
        # Load the dataset
        dataset = load_from_disk(full_dataset_path)
        print(f"✓ Loaded dataset with {len(dataset)} entries")
        
        # Filter to single-type Pokemon
        filtered_entries = self.filter_single_type_pokemon(dataset)
        
        # Group by type
        type_groups = self.group_by_type(filtered_entries)
        
        print(f"\n📊 Pokemon count by type:")
        for type_name in self.type_order:
            count = len(type_groups.get(type_name, []))
            print(f"  {type_name}: {count}")
        
        # Create 8-shot dataset
        print(f"\n🎯 Creating 8-shot training dataset...")
        train_8_shot = self.sample_training_set(type_groups, shots_per_type=8)
        
        # Create smaller datasets by subsampling
        shots_configs = [8, 4, 2, 1]
        datasets = {}
        
        for shots in shots_configs:
            print(f"\n🎯 Creating {shots}-shot training dataset...")
            
            if shots == 8:
                current_entries = train_8_shot
            else:
                # Subsample from 8-shot
                current_entries = []
                type_counts = defaultdict(int)
                
                # Group 8-shot entries by effective type (same logic as grouping)
                shot_8_by_type = defaultdict(list)
                for entry in train_8_shot:
                    primary_type = entry['primary_type']
                    secondary_type = entry['secondary_type']
                    
                    # Use same grouping logic as in group_by_type
                    if ((primary_type == 'Normal' and secondary_type == 'Flying') or
                        (primary_type == 'Flying' and secondary_type == 'Normal')):
                        shot_8_by_type['Flying'].append(entry)
                    elif ((primary_type == 'Steel' and secondary_type == 'Rock') or
                          (primary_type == 'Rock' and secondary_type == 'Steel')):
                        shot_8_by_type['Steel'].append(entry)
                    elif secondary_type is None:
                        shot_8_by_type[primary_type].append(entry)
                    # For verification: check Normal and Ground types are actually single-type
                    elif primary_type in ['Normal', 'Ground'] and secondary_type is not None:
                        print(f"⚠️  Found non-single {primary_type} type: {entry['name']} ({primary_type}/{secondary_type})")
                        # Still group by primary type for now
                        shot_8_by_type[primary_type].append(entry)
                
                # Sample from each type
                for type_name in self.type_order:
                    if type_name not in shot_8_by_type:
                        continue
                    
                    candidates = shot_8_by_type[type_name].copy()
                    
                    # Prioritize single-type Pokemon for sampling
                    single_type_candidates = [entry for entry in candidates if entry['secondary_type'] is None]
                    dual_type_candidates = [entry for entry in candidates if entry['secondary_type'] is not None]
                    
                    # Special handling for Flying type
                    if type_name == 'Flying' and shots > 1:
                        # Must include both Tornadus and Rookidee/Corvisquire
                        required = []
                        single_others = []
                        dual_others = []
                        
                        for entry in candidates:
                            if entry['name'] in ['Tornadus', 'Rookidee', 'Corvisquire']:
                                required.append(entry)
                            elif entry['secondary_type'] is None:
                                single_others.append(entry)
                            else:
                                dual_others.append(entry)
                        
                        # Take required first, then single-type, then dual-type
                        selected = required[:2]  # Max 2 required
                        if len(selected) < shots:
                            random.shuffle(single_others)
                            selected.extend(single_others[:shots-len(selected)])
                        if len(selected) < shots:
                            random.shuffle(dual_others)
                            selected.extend(dual_others[:shots-len(selected)])
                    elif type_name == 'Flying':
                        # For 1-shot Flying, prioritize single-type but fall back to dual-type
                        random.shuffle(single_type_candidates)
                        random.shuffle(dual_type_candidates)
                        
                        selected = single_type_candidates[:shots]
                        if len(selected) < shots:
                            selected.extend(dual_type_candidates[:shots-len(selected)])
                    else:
                        # Regular sampling: prioritize single-type
                        random.shuffle(single_type_candidates)
                        random.shuffle(dual_type_candidates)
                        
                        selected = single_type_candidates[:shots]
                        if len(selected) < shots:
                            selected.extend(dual_type_candidates[:shots-len(selected)])
                    
                    current_entries.extend(selected)
            
            # Create dataset
            dataset_dict = {
                'image': [entry['image'] for entry in current_entries],
                'primary_type': [entry['primary_type'] for entry in current_entries],
                'secondary_type': [entry['secondary_type'] for entry in current_entries],
                'art_style': [entry['art_style'] for entry in current_entries],
                'name': [entry['name'] for entry in current_entries],
                'number': [entry['number'] for entry in current_entries],
                'paradox_or_ultrabeast': [entry.get('paradox_or_ultrabeast', 'no') for entry in current_entries]
            }
            
            train_dataset = Dataset.from_dict(dataset_dict)
            datasets[f"{shots}_shot"] = train_dataset
            
            # Save individual dataset
            output_path = f"{output_base_name}_{shots}_shot"
            train_dataset.save_to_disk(output_path)
            
            print(f"✓ Saved {shots}-shot dataset with {len(train_dataset)} entries to {output_path}")
            
            # Print type distribution
            type_dist = defaultdict(int)
            for entry in current_entries:
                type_dist[entry['primary_type']] += 1
            
            print(f"  Type distribution:")
            for type_name in self.type_order:
                if type_name in type_dist:
                    print(f"    {type_name}: {type_dist[type_name]}")
        
        return datasets, train_8_shot
    
    def create_eval_datasets(self, full_dataset_path, train_8_shot_entries):
        """Create standard_eval and other_eval datasets"""
        print(f"\n=== Creating evaluation datasets ===")
        
        # Load the dataset
        dataset = load_from_disk(full_dataset_path)
        print(f"✓ Loaded dataset with {len(dataset)} entries")
        
        # Debug: Check art style distribution in full dataset
        art_style_counts = defaultdict(int)
        for entry in dataset:
            art_style_counts[entry['art_style']] += 1
        
        print(f"📊 Full dataset art style distribution:")
        for art_style, count in art_style_counts.items():
            print(f"  {art_style}: {count}")
        
        # Get names of training Pokemon
        train_names = set(entry['name'] for entry in train_8_shot_entries)
        print(f"✓ Training set contains {len(train_names)} unique Pokemon names")
        
        # Separate standard and other art styles
        standard_entries = []
        other_entries = []
        excluded_by_training = 0
        
        for entry in dataset:
            if entry['name'] not in train_names:  # Exclude training entries
                if entry['art_style'] == 'standard':
                    standard_entries.append(entry)
                else:
                    other_entries.append(entry)
            else:
                excluded_by_training += 1
        
        print(f"✓ Found {len(standard_entries)} standard entries not in training")
        print(f"✓ Found {len(other_entries)} non-standard entries")
        print(f"✓ Excluded {excluded_by_training} entries due to training Pokemon name overlap")
        
        # Create standard_eval dataset
        print(f"\n📊 Creating standard_eval dataset...")
        standard_test = self.sample_eval_test_set(standard_entries, samples_per_type=8)
        
        # Include test entries in streaming split
        standard_streaming = standard_entries  # Include all entries including test
        
        standard_eval = DatasetDict({
            'test': Dataset.from_dict({
                'image': [entry['image'] for entry in standard_test],
                'primary_type': [entry['primary_type'] for entry in standard_test],
                'secondary_type': [entry['secondary_type'] for entry in standard_test],
                'art_style': [entry['art_style'] for entry in standard_test],
                'name': [entry['name'] for entry in standard_test],
                'number': [entry['number'] for entry in standard_test],
                'paradox_or_ultrabeast': [entry.get('paradox_or_ultrabeast', 'no') for entry in standard_test]
            }),
            'streaming': Dataset.from_dict({
                'image': [entry['image'] for entry in standard_streaming],
                'primary_type': [entry['primary_type'] for entry in standard_streaming],
                'secondary_type': [entry['secondary_type'] for entry in standard_streaming],
                'art_style': [entry['art_style'] for entry in standard_streaming],
                'name': [entry['name'] for entry in standard_streaming],
                'number': [entry['number'] for entry in standard_streaming],
                'paradox_or_ultrabeast': [entry.get('paradox_or_ultrabeast', 'no') for entry in standard_streaming]
            })
        })
        
        standard_eval.save_to_disk("standard_eval_dataset")
        print(f"✓ Saved standard_eval dataset: test={len(standard_test)}, streaming={len(standard_streaming)}")
        
        # Create other_eval dataset
        print(f"\n📊 Creating other_eval dataset...")
        other_test = self.sample_eval_test_set(other_entries, samples_per_type=8)
        
        # Include test entries in streaming split
        other_streaming = other_entries  # Include all entries including test
        
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
                'image': [entry['image'] for entry in other_streaming],
                'primary_type': [entry['primary_type'] for entry in other_streaming],
                'secondary_type': [entry['secondary_type'] for entry in other_streaming],
                'art_style': [entry['art_style'] for entry in other_streaming],
                'name': [entry['name'] for entry in other_streaming],
                'number': [entry['number'] for entry in other_streaming],
                'paradox_or_ultrabeast': [entry.get('paradox_or_ultrabeast', 'no') for entry in other_streaming]
            })
        })
        
        other_eval.save_to_disk("other_eval_dataset")
        print(f"✓ Saved other_eval dataset: test={len(other_test)}, streaming={len(other_streaming)}")
        
        return standard_eval, other_eval
    
    def sample_eval_test_set(self, entries, samples_per_type=8):
        """Sample test set from evaluation entries with Flying type fallback"""
        type_groups = defaultdict(list)
        
        # Group by primary type and collect Flying-related entries
        flying_dual_type_entries = []
        
        for entry in entries:
            primary_type = entry['primary_type']
            secondary_type = entry['secondary_type']
            
            # Regular grouping by primary type
            type_groups[primary_type].append(entry)
            
            # Collect Flying dual-type entries for fallback
            if secondary_type == 'Flying':
                flying_dual_type_entries.append(entry)
        
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
                random.shuffle(single_flying)
                
                selected = single_flying[:samples_per_type]
                
                # If we need more, use dual-type entries with secondary_type == 'Flying'
                if len(selected) < samples_per_type:
                    needed = samples_per_type - len(selected)
                    print(f"    Need {needed} more Flying Pokemon, using dual-type fallback")
                    
                    # Filter out entries already selected and ensure they're not in training
                    available_flying_dual = [entry for entry in flying_dual_type_entries 
                                           if entry not in selected]
                    random.shuffle(available_flying_dual)
                    selected.extend(available_flying_dual[:needed])
            else:
                # Regular sampling for other types
                random.shuffle(candidates)
                selected = candidates[:samples_per_type]
            
            test_entries.extend(selected)
            print(f"✓ Selected {len(selected)} {type_name} type Pokemon for eval test set")
        
        return test_entries

def main():
    print("🚀 Pokemon Dataset Creator")
    print("=" * 50)
    
    creator = PokemonDatasetCreator()
    
    # Fetch evolution chains
    creator.fetch_evolution_chains()
    
    # Dataset paths
    full_dataset_path = "pokemon_dataset_with_paradox_updated"
    output_base_name = "IVL_CLS_pokemon"
    
    # Create training datasets (1-shot, 2-shot, 4-shot, 8-shot)
    training_datasets, train_8_shot_entries = creator.create_n_shot_datasets(
        full_dataset_path, output_base_name
    )
    
    # Create evaluation datasets
    standard_eval, other_eval = creator.create_eval_datasets(
        full_dataset_path, train_8_shot_entries
    )
    
    print(f"\n🎉 All datasets created successfully!")
    print(f"\n📋 Summary:")
    print(f"  Training datasets:")
    for shots in [1, 2, 4, 8]:
        print(f"    {shots}-shot: {output_base_name}_{shots}_shot")
    print(f"  Evaluation datasets:")
    print(f"    Standard eval: standard_eval_dataset")
    print(f"    Other eval: other_eval_dataset")

if __name__ == "__main__":
    # Required packages: pip install requests beautifulsoup4 datasets
    main()
