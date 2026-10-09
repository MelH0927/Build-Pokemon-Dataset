import requests
import pandas as pd
from bs4 import BeautifulSoup
import time
import re
from urllib.parse import urljoin, urlparse
import os
from datasets import Dataset
from huggingface_hub import HfApi
import io
from PIL import Image
import matplotlib.pyplot as plt

class PokemonDatasetBuilder:
    def fetch_animated_images(self, pokemon_name):
        """Fetch 'animated' (anime) images from Fandom wiki focusing on Appearances/Anime sections.
        Strategy:
        1. Get the main Pokemon page HTML source
        2. Look for specific Fandom gallery structures (tabber, appearances, anime sections)
        3. Extract File: links from galleries and tabber structures
        4. Get full resolution images from file pages
        5. Return PIL Image objects resized appropriately
        """
        session = self.session
        base_page_slug = pokemon_name.replace(' ', '_').replace("'", "")
        page_url = f"https://pokemon.fandom.com/wiki/{base_page_slug}"
        print(f"Searching for anime/animated images for {pokemon_name}...")
        
        try:
            resp = session.get(page_url, timeout=15)
            resp.raise_for_status()
            
            # Get the raw HTML content to find File: references
            page_content = resp.text
            soup = BeautifulSoup(resp.content, 'html.parser')
            
            images = []
            seen_img_urls = set()
            
            # Strategy 1: Extract File: references from page source (most reliable)
            print(f"  Looking for File: references in page source...")
            import re
            
            # Find all File: references in the page source
            file_patterns = [
                r'File:([^"\|\s\]]+\.(?:png|jpg|jpeg|gif|webp))',  # Standard File: patterns
                r'file=([^&\s\'"]+\.(?:png|jpg|jpeg|gif|webp))',    # URL file= parameters
                r'/([^/\s\'"]+_anime[^/\s\'"]*\.(?:png|jpg|jpeg|gif|webp))',  # _anime in filename
                r'/([^/\s\'"]+_appearance[^/\s\'"]*\.(?:png|jpg|jpeg|gif|webp))',  # _appearance in filename
            ]
            
            file_names = set()
            for pattern in file_patterns:
                matches = re.findall(pattern, page_content, re.IGNORECASE)
                for match in matches:
                    # Clean the filename
                    filename = match.split('/')[-1].split('?')[0]
                    if pokemon_name.lower().replace(' ', '_') in filename.lower():
                        file_names.add(filename)
            
            print(f"    Found {len(file_names)} potential file references")
            
            # Strategy 2: Look for gallery sections specifically in Appearances/Anime areas
            print(f"  Looking for Appearances/Anime sections...")
            
            # Find sections that might contain anime images
            anime_sections = []
            
            # Look for headings containing "Appearances", "Anime", "Gallery"
            headings = soup.find_all(['h2', 'h3', 'h4'], string=re.compile(r'(Appearances|Anime|Gallery)', re.IGNORECASE))
            for heading in headings:
                # Get the section content after this heading
                section_content = ""
                current = heading.next_sibling
                while current and not (hasattr(current, 'name') and current.name in ['h1', 'h2', 'h3']):
                    if hasattr(current, 'get_text'):
                        section_content += str(current)
                    current = current.next_sibling if current else None
                anime_sections.append(section_content)
            
            # Extract file references from anime sections
            for section in anime_sections:
                for pattern in file_patterns:
                    matches = re.findall(pattern, section, re.IGNORECASE)
                    for match in matches:
                        filename = match.split('/')[-1].split('?')[0]
                        if pokemon_name.lower().replace(' ', '_') in filename.lower():
                            file_names.add(filename)
            
            # Strategy 3: Process each file reference
            print(f"  Processing {len(file_names)} file references...")
            for filename in list(file_names)[:8]:  # Limit to avoid too many requests
                try:
                    # Construct file page URL
                    clean_filename = filename.replace(' ', '_')
                    file_url = f"https://pokemon.fandom.com/wiki/File:{clean_filename}"
                    
                    print(f"    Checking file page: {clean_filename}")
                    print(f"      URL: {file_url}")
                    file_resp = session.get(file_url, timeout=10)
                    
                    if file_resp.ok:
                        file_soup = BeautifulSoup(file_resp.content, 'html.parser')
                        
                        # Look for the actual image on the file page
                        img_candidates = [
                            file_soup.find('div', class_='fullImageLink'),
                            file_soup.find('a', class_='internal'),
                            file_soup.find('img', alt=re.compile(clean_filename, re.IGNORECASE))
                        ]
                        
                        for candidate in img_candidates:
                            if candidate:
                                img_tag = candidate.find('img') if candidate.name != 'img' else candidate
                                if img_tag:
                                    img_src = img_tag.get('src')
                                    if img_src and img_src not in seen_img_urls:
                                        # Clean the URL to get full resolution
                                        if '/revision/' in img_src:
                                            clean_url = img_src.split('/revision/')[0]
                                        else:
                                            clean_url = img_src
                                        
                                        # Remove thumbnail scaling
                                        clean_url = re.sub(r"/thumb/(.+)/\d+px-[^/]+", r"/\1", clean_url)

                                        seen_img_urls.add(clean_url)
                                        print(f"      Found image: {clean_url}")
                                        
                                        pil_image = self.download_image(clean_url, is_pixel_art=False)
                                        if pil_image:
                                            images.append(pil_image)
                                        break
                                        
                except Exception as e:
                    print(f"    Error processing file {filename}: {e}")
                    continue
            
            # Strategy 4: Fallback - look for any images with *_{pokemon_name}.png pattern
            print(f"  Looking for images with *_{pokemon_name}.png pattern...")
            pokemon_slug = pokemon_name.lower().replace(' ', '_').replace("'", "")
            keyword_patterns = [
                rf'https://static\.wikia\.nocookie\.net/[^"\s]*[^/\s]*_{re.escape(pokemon_slug)}\.png'
            ]
            
            for pattern in keyword_patterns:
                matches = re.findall(pattern, page_content, re.IGNORECASE)
                for url in matches[:3]:  # Limit per pattern
                    if pokemon_name.lower() in url.lower() and url not in seen_img_urls:
                        seen_img_urls.add(url)
                        print(f"    Found keyword image: {url}")
                        pil_image = self.download_image(url, is_pixel_art=False)
                        if pil_image:
                            images.append(pil_image)
            
            if images:
                print(f"  ✓ Collected {len(images)} anime/animated images for {pokemon_name}")
            else:
                print(f"  No anime/animated images found for {pokemon_name}")
                
            return images
            
        except Exception as e:
            print(f"  Error fetching animated images for {pokemon_name}: {e}")
            return []

    def __init__(self):
        self.base_url = "https://pokemondb.net"
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        })
        self.pokemon_data = []
        
    def get_page(self, url, retries=1):
        """Fetch a webpage with retries and error handling"""
        for attempt in range(retries):
            try:
                response = self.session.get(url, timeout=10)
                response.raise_for_status()
                return response
            except requests.RequestException as e:
                print(f"Attempt {attempt + 1} failed for {url}: {e}")
                if attempt < retries - 1:
                    time.sleep(2)
                else:
                    return None
    
    #def should_skip_pokemon(self, name):
    #    """Check if Pokemon should be skipped based on name"""
    #    skip_keywords = ['mega', 'alolan', 'galarian', 'hisuian', 'paldean', 'gigantamax', 'primal', 'gmax']
    #    name_lower = name.lower()
    #    return any(keyword in name_lower for keyword in skip_keywords)
    
    def is_base_pokemon(self, row):
        """Check if this is the base Pokemon (not a variant) by looking at the row structure"""
        # Check if there's a small tag or variant indicator in the name cell
        name_cell = row.find_all('td')[1]  # Second column is name
        small_tags = name_cell.find_all('small')
        
        # If there are small tags with variant info, skip this row
        if small_tags:
            variant_text = ' '.join([tag.get_text().lower() for tag in small_tags])
            variant_keywords = ['mega', 'alolan', 'galarian', 'hisuian', 'paldean', 'gigantamax', 'primal', 'gmax']
            if any(keyword in variant_text for keyword in variant_keywords):
                return False
        
        return True
    
    def parse_types(self, type_cell):
        """Parse Pokemon types from the type cell"""
        type_links = type_cell.find_all('a')
        types = [link.get_text().strip() for link in type_links]
        
        primary_type = types[0] if types else None
        secondary_type = types[1] if len(types) > 1 else None
        
        return primary_type, secondary_type
    
    def fetch_pokemon_list(self):
        """Fetch the main Pokemon list from pokemondb.net/pokedex/all"""
        print("Fetching Pokemon list...")
        url = "https://pokemondb.net/pokedex/all"
        response = self.get_page(url)
        
        if not response:
            raise Exception("Failed to fetch Pokemon list")
        
        soup = BeautifulSoup(response.content, 'html.parser')
        table = soup.find('table', {'id': 'pokedex'})
        
        if not table:
            raise Exception("Could not find Pokemon table")
        
        pokemon_list = []
        seen_numbers = set()  # Track Pokemon numbers we've already processed
        rows = table.find('tbody').find_all('tr')
        
        for row in rows:
            cells = row.find_all('td')
            if len(cells) >= 3:
                # Get Pokemon number and name
                number_cell = cells[0]
                name_cell = cells[1]
                type_cell = cells[2]
                
                # Extract Pokemon number
                number_text = number_cell.get_text().strip()
                # Remove any non-digit characters and leading zeros for comparison
                pokemon_number = number_text.lstrip('#').zfill(4)  # Ensure 4-digit format like "0003"
                
                # Skip if we've already processed this Pokemon number
                if pokemon_number in seen_numbers:
                    print(f"Skipping duplicate number {pokemon_number} for {name_cell.get_text().strip()}")
                    continue
                
                # Skip variants (check for base Pokemon only)
                if not self.is_base_pokemon(row):
                    continue
                
                # Extract name and link
                name_link = name_cell.find('a')
                if name_link:
                    name = name_link.get_text().strip()
                    pokemon_url = urljoin(self.base_url, name_link['href'])
                    
                    # Additional check to skip special versions in name
                    #if self.should_skip_pokemon(name):
                    #    continue
                    
                    # Parse types
                    primary_type, secondary_type = self.parse_types(type_cell)
                    
                    # Add this Pokemon number to seen set
                    seen_numbers.add(pokemon_number)
                    
                    pokemon_list.append({
                        'name': name,
                        'number': pokemon_number,
                        'url': pokemon_url,
                        'primary_type': primary_type,
                        'secondary_type': secondary_type
                    })
                    
                    print(f"Added Pokemon #{pokemon_number}: {name}")
        
        print(f"Found {len(pokemon_list)} unique Pokemon to process")
        return pokemon_list
    
    def resize_image(self, image, target_size=(256, 256), is_pixel_art=False):
        """Resize image to target size while maintaining aspect ratio, or zoom pixel art"""
        if not image:
            return None
        
        # Convert to RGB if necessary (handles RGBA, P mode, etc.)
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        if is_pixel_art:
            # For pixel art, zoom to fill the target size using nearest neighbor to maintain sharp pixels
            new_image = image.resize(target_size, Image.Resampling.NEAREST)
        else:
            # For other art styles, resize while maintaining aspect ratio
            image.thumbnail(target_size, Image.Resampling.LANCZOS)
            
            # Create a new image with the target size and paste the resized image
            new_image = Image.new('RGB', target_size, (255, 255, 255))  # White background
            
            # Center the image
            x = (target_size[0] - image.size[0]) // 2
            y = (target_size[1] - image.size[1]) // 2
            new_image.paste(image, (x, y))
        
        return new_image
    
    def download_image(self, img_url, is_pixel_art=False):
        """Download image and return as PIL Image, resized to standard size"""
        try:
            response = self.get_page(img_url)
            if response:
                image = Image.open(io.BytesIO(response.content))
                # Resize to standard size
                resized_image = self.resize_image(image, target_size=(384, 384), is_pixel_art=is_pixel_art)
                return resized_image
        except Exception as e:
            print(f"Failed to download image {img_url}: {e}")
        return None
    
    def fetch_pokemon_images(self, pokemon_url, pokemon_name):
        """Fetch three different style images for a Pokemon"""
        print(f"Fetching images for {pokemon_name}...")
        response = self.get_page(pokemon_url)
        
        if not response:
            print(f"Failed to fetch page for {pokemon_name}")
            return []
        
        soup = BeautifulSoup(response.content, 'html.parser')
        images = []
        
        # 1. Official artwork (standard style) - Look for main artwork
        try:
            # Try multiple selectors for the main artwork
            artwork_img = None
            
            # Method 1: Look for the main Pokemon image
            main_img = soup.find('img', {'alt': re.compile(pokemon_name, re.IGNORECASE)})
            if main_img and 'artwork' in main_img.get('src', '').lower():
                artwork_img = main_img
            
            # Method 2: Look in the main content area
            if not artwork_img:
                content_area = soup.find('div', class_='grid-col span-md-6 span-lg-8')
                if content_area:
                    potential_imgs = content_area.find_all('img')
                    for img in potential_imgs:
                        src = img.get('src', '')
                        if 'artwork' in src.lower() or 'normal' in src.lower():
                            artwork_img = img
                            break
            
            # Method 3: Look for any large image that might be artwork
            if not artwork_img:
                all_imgs = soup.find_all('img')
                for img in all_imgs:
                    src = img.get('src', '')
                    if any(term in src.lower() for term in ['artwork', 'dream-world', 'official']):
                        artwork_img = img
                        break
            
            if artwork_img and artwork_img.get('src'):
                img_url = urljoin(self.base_url, artwork_img['src'])
                print(f"Trying artwork URL: {img_url}")
                image = self.download_image(img_url, is_pixel_art=False)
                if image:
                    images.append(('standard', image))
                    print(f"✓ Found official artwork for {pokemon_name}")
                    
        except Exception as e:
            print(f"Failed to get official artwork for {pokemon_name}: {e}")
        
        # 2. Evolution chart image (3D style) - More robust search
        try:
            # Look for evolution section
            evo_sections = soup.find_all('div', class_='infocard-list-evo')
            if not evo_sections:
                evo_sections = soup.find_all('div', class_='infocard-list')
            
            for evo_section in evo_sections:
                pokemon_cards = evo_section.find_all('div', class_='infocard')
                for card in pokemon_cards:
                    # Check if this card represents our Pokemon
                    card_name_elem = card.find('a', class_='ent-name')
                    if card_name_elem:
                        card_name = card_name_elem.get_text().strip()
                        if pokemon_name.lower() == card_name.lower():
                            evo_img = card.find('img')
                            if evo_img and evo_img.get('src'):
                                img_url = urljoin(self.base_url, evo_img['src'])
                                print(f"Trying evolution URL: {img_url}")
                                image = self.download_image(img_url, is_pixel_art=False)
                                if image:
                                    images.append(('3D', image))
                                    print(f"✓ Found evolution chart image for {pokemon_name}")
                                    break
                if len([img for style, img in images if style == '3D']) > 0:
                    break
                    
        except Exception as e:
            print(f"Failed to get evolution chart image for {pokemon_name}: {e}")
        
        # 3. Sprite image (pixel style) - Direct URL construction for Generation 5
        try:
            sprite_found = False
            
            # Method 1: Construct Generation 5 (Black/White) sprite URL directly
            pokemon_name_clean = pokemon_name.lower().replace(' ', '-').replace('.', '').replace("'", '')
            gen5_sprite_url = f"https://img.pokemondb.net/sprites/black-white/normal/{pokemon_name_clean}.png"
            print(f"Trying constructed Gen 5 sprite URL: {gen5_sprite_url}")
            image = self.download_image(gen5_sprite_url, is_pixel_art=True)
            if image:
                images.append(('pixel', image))
                print(f"✓ Found Gen 5 sprite for {pokemon_name}")
                sprite_found = True
            
            # Method 2: Try other generations if Gen 5 fails
            if not sprite_found:
                sprite_generations = [
                    'diamond-pearl',
                    'ruby-sapphire',
                    'sword-shield'
                ]
                
                for gen in sprite_generations:
                    sprite_url = f"https://img.pokemondb.net/sprites/{gen}/normal/{pokemon_name_clean}.png"
                    print(f"Trying {gen} sprite URL: {sprite_url}")
                    image = self.download_image(sprite_url, is_pixel_art=True)
                    if image:
                        images.append(('pixel', image))
                        print(f"✓ Found {gen} sprite for {pokemon_name}")
                        sprite_found = True
                        break
            
            # Method 3: Look for sprite URLs in the page source (fallback)
            if not sprite_found:
                page_content = response.text
                sprite_pattern = r'https://img\.pokemondb\.net/sprites/[^"\']+/normal/[^"\']*' + re.escape(pokemon_name_clean) + r'[^"\']*\.png'
                sprite_matches = re.findall(sprite_pattern, page_content, re.IGNORECASE)
                
                for sprite_url in sprite_matches[:3]:  # Try first 3 matches
                    print(f"Trying found sprite URL: {sprite_url}")
                    image = self.download_image(sprite_url, is_pixel_art=True)
                    if image:
                        images.append(('pixel', image))
                        print(f"✓ Found sprite via regex for {pokemon_name}")
                        break
                        
        except Exception as e:
            print(f"Failed to get sprite image for {pokemon_name}: {e}")
        
        # 4. Animated images from Fandom wiki
        try:
            animated_images = self.fetch_animated_images(pokemon_name)
            for image in animated_images:
                images.append(('animated', image))
        except Exception as e:
            print(f"Failed to get animated images for {pokemon_name}: {e}")

        return images
    
    def build_dataset(self, limit=None):
        """Build the complete Pokemon dataset"""
        pokemon_list = self.fetch_pokemon_list()
        
        if limit:
            pokemon_list = pokemon_list[:limit]
            print(f"Processing first {limit} Pokemon for testing...")
        
        for i, pokemon in enumerate(pokemon_list):
            print(f"\nProcessing {pokemon['name']} (#{pokemon['number']}) ({i+1}/{len(pokemon_list)})...")
            
            images = self.fetch_pokemon_images(pokemon['url'], pokemon['name'])
            
            # Add each image as a separate row
            for art_style, image in images:
                entry = {
                    'image': image,
                    'primary_type': pokemon['primary_type'],
                    'secondary_type': pokemon['secondary_type'],
                    'art_style': art_style,
                    'name': pokemon['name'],
                    'number': pokemon['number']
                }
                self.pokemon_data.append(entry)
            
            # Rate limiting to be respectful
            time.sleep(1)
        
        print(f"\nDataset building complete! Total entries: {len(self.pokemon_data)}")
        return self.pokemon_data
    
    def create_huggingface_dataset(self):
        """Convert the data to HuggingFace Dataset format"""
        if not self.pokemon_data:
            raise Exception("No data to convert. Run build_dataset() first.")
        
        # Prepare data for HuggingFace Dataset
        dataset_dict = {
            'image': [entry['image'] for entry in self.pokemon_data],
            'primary_type': [entry['primary_type'] for entry in self.pokemon_data],
            'secondary_type': [entry['secondary_type'] for entry in self.pokemon_data],
            'art_style': [entry['art_style'] for entry in self.pokemon_data],
            'name': [entry['name'] for entry in self.pokemon_data],
            'number': [entry['number'] for entry in self.pokemon_data]
        }
        
        dataset = Dataset.from_dict(dataset_dict)
        return dataset
    
    def save_dataset_locally(self, dataset, path="pokemon_dataset"):
        """Save dataset locally"""
        dataset.save_to_disk(path)
        print(f"Dataset saved locally to {path}")
    
    def push_to_huggingface(self, dataset, repo_name, hf_token=None):
        """Push dataset to HuggingFace Hub"""
        try:
            if hf_token:
                api = HfApi(token=hf_token)
            else:
                api = HfApi()
            
            # Push the dataset
            dataset.push_to_hub(repo_name, token=hf_token)
            print(f"Dataset successfully pushed to HuggingFace: {repo_name}")
            
        except Exception as e:
            print(f"Failed to push to HuggingFace: {e}")
            print("Make sure you have:")
            print("1. Valid HuggingFace token")
            print("2. Correct repository name")
            print("3. Proper permissions")
    
    def view_sample_images(self, num_pokemon=3):
        """Display sample images from the dataset"""
        if not self.pokemon_data:
            print("No data available. Run build_dataset() first.")
            return
        
        # Group by Pokemon name to show all art styles for each Pokemon
        pokemon_groups = {}
        for entry in self.pokemon_data:
            name = entry['name']
            if name not in pokemon_groups:
                pokemon_groups[name] = []
            pokemon_groups[name].append(entry)
        
        # Display first few Pokemon with all their art styles
        pokemon_names = list(pokemon_groups.keys())[:num_pokemon]
        
        for pokemon_name in pokemon_names:
            entries = pokemon_groups[pokemon_name]
            num_images = len(entries)
            
            if num_images == 0:
                continue
                
            print(f"\n=== {pokemon_name} ===")
            
            # Create subplot for this Pokemon
            fig, axes = plt.subplots(1, num_images, figsize=(5*num_images, 5))
            if num_images == 1:
                axes = [axes]
            
            for i, entry in enumerate(entries):
                axes[i].imshow(entry['image'])
                axes[i].set_title(f"{entry['art_style']} style\n{entry['primary_type']}" + 
                                (f"/{entry['secondary_type']}" if entry['secondary_type'] else ""))
                axes[i].axis('off')
            
            plt.tight_layout()
            plt.show()
    
    def save_sample_images(self, output_dir="sample_images", num_pokemon=5):
        """Save sample images to files for inspection"""
        if not self.pokemon_data:
            print("No data available. Run build_dataset() first.")
            return
        
        os.makedirs(output_dir, exist_ok=True)
        
        # Group by Pokemon name
        pokemon_groups = {}
        for entry in self.pokemon_data:
            name = entry['name']
            if name not in pokemon_groups:
                pokemon_groups[name] = []
            pokemon_groups[name].append(entry)
        
        # Save first few Pokemon images
        pokemon_names = list(pokemon_groups.keys())[:num_pokemon]
        
        for pokemon_name in pokemon_names:
            entries = pokemon_groups[pokemon_name]
            for entry in entries:
                filename = f"{pokemon_name}_{entry['art_style']}.png"
                filepath = os.path.join(output_dir, filename)
                entry['image'].save(filepath)
                print(f"Saved: {filepath}")
        
        print(f"\nSample images saved to {output_dir}/ directory")
    
    def dataset_summary(self):
        """Display a summary of the collected data"""
        if not self.pokemon_data:
            print("No data available. Run build_dataset() first.")
            return
        
        df = pd.DataFrame([
            {
                'number': entry['number'],
                'name': entry['name'],
                'primary_type': entry['primary_type'],
                'secondary_type': entry['secondary_type'],
                'art_style': entry['art_style'],
                'image_size': f"{entry['image'].size[0]}x{entry['image'].size[1]}"
            }
            for entry in self.pokemon_data
        ])
        
        print(f"\n=== Dataset Summary ===")
        print(f"Total entries: {len(df)}")
        print(f"Unique Pokemon: {df['name'].nunique()}")
        print(f"Unique Pokemon numbers: {df['number'].nunique()}")
        print(f"\nArt style distribution:")
        print(df['art_style'].value_counts())
        print(f"\nPrimary type distribution:")
        print(df['primary_type'].value_counts().head(10))
        print(f"\nSample entries:")
        print(df.head(10).to_string(index=False))
        
        return df

def main():
    # Initialize the dataset builder
    builder = PokemonDatasetBuilder()
    
    # Build the dataset (use limit for testing, remove for full dataset)
    # For testing, you might want to start with limit=10
    pokemon_data = builder.build_dataset()  # Remove limit parameter for full dataset
    
    # Create HuggingFace dataset
    dataset = builder.create_huggingface_dataset()
    
    # Save locally first
    builder.save_dataset_locally(dataset, "pokemon_dataset")
    
    # Display dataset info and summary
    print(f"\nDataset created with {len(dataset)} entries")
    print(f"Features: {dataset.features}")
    
    # Show detailed summary
    summary_df = builder.dataset_summary()
    
    # View sample images in matplotlib
    print("\nDisplaying sample images...")
    builder.view_sample_images(num_pokemon=3)
    
    # Save sample images to files
    print("\nSaving sample images to files...")
    builder.save_sample_images(output_dir="sample_images", num_pokemon=5)
    
    # Push to HuggingFace (uncomment and configure when ready)
    # HF_TOKEN = "your_huggingface_token_here"  # Get from https://huggingface.co/settings/tokens
    # REPO_NAME = "your_username/pokemon-dataset"  # Replace with your desired repo name
    # builder.push_to_huggingface(dataset, REPO_NAME, HF_TOKEN)

if __name__ == "__main__":
    # Required packages - install with:
    # pip install requests beautifulsoup4 pandas datasets huggingface_hub pillow matplotlib
    
    main()