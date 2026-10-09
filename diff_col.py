from datasets import load_from_disk
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent

# List of Paradox Pokémon & Ultra Beasts
paradox_and_ultrabeasts = [
    "Nihilego", "Buzzwole", "Pheromosa", "Xurkitree", "Celesteela",
    "Kartana", "Guzzlord", "Poipole", "Naganadel", "Stakataka", "Blacephalon",
    "Great Tusk", "Scream Tail", "Brute Bonnet", "Flutter Mane", "Slither Wing",
    "Sandy Shocks", "Roaring Moon",
    "Iron Treads", "Iron Bundle", "Iron Hands", "Iron Jugulis",
    "Iron Thorns", "Iron Moth", "Iron Valiant",
    "Raging Bolt", "Gouging Fire", "Iron Crown", "Iron Boulder"
]

# Load your dataset (replace path with your actual dataset folder)
dataset = load_from_disk(str(HERE / "pokemon_dataset"))

# Add new column
def mark_paradox(example):
    example["paradox_or_ultrabeast"] = (
        "yes" if example["name"] in paradox_and_ultrabeasts else "no"
    )
    return example

dataset = dataset.map(mark_paradox)

# Save updated dataset back to disk
dataset.save_to_disk(str(HERE / "pokemon_dataset_with_paradox"))

# --- Optional: update dataset_info.json schema ---
with open(HERE / "pokemon_dataset/dataset_info.json", "r") as f:
    info = json.load(f)

# Add the new feature to schema
info["features"]["paradox_or_ultrabeast"] = {
    "dtype": "string",
    "_type": "Value"
}

with open(HERE / "pokemon_dataset_with_paradox/dataset_info.json", "w") as f:
    json.dump(info, f, indent=2)

print("✅ Dataset updated with paradox_or_ultrabeast column")
