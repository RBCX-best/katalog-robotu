import os
import re
import json
import urllib.request
import unicodedata

def slugify(text):
    # Normalize unicode to decompose accents/diacritics
    nfkd_form = unicodedata.normalize('NFKD', text)
    only_ascii = nfkd_form.encode('ASCII', 'ignore').decode('ASCII')
    # Keep only letters, numbers, underscores, and hyphens, replace spaces with underscores
    slug = re.sub(r'[^a-zA-Z0-9_-]', '', only_ascii.replace(' ', '_'))
    return slug.lower()

def extract_image_url(text):
    # Match markdown format: ![alt_text](url)
    match = re.search(r'!\[.*?\]\((https?://[^\s)]+)\)', text)
    if match:
        return match.group(1)
    # Match HTML format: <img src="url" ...>
    match = re.search(r'<img\s+[^>]*src=["\'](https?://[^"\']+)["\']', text)
    if match:
        return match.group(1)
    # Match raw url format
    match = re.search(r'(https?://[^\s]+)', text)
    if match:
        return match.group(1)
    return None

def main():
    body = os.environ.get('ISSUE_BODY', '')
    issue_number = os.environ.get('ISSUE_NUMBER', '0')
    issue_url = os.environ.get('ISSUE_URL', '')

    if not body:
        print("Error: ISSUE_BODY environment variable is empty or not set.")
        return 1

    # Parse key-value Markdown fields: - **Key**: Value
    matches = re.findall(r'-\s*\*\*(.*?)\*\*:\s*(.*)', body)
    data = {key.strip(): value.strip() for key, value in matches}

    # Map form Czech field names to our internal JSON keys
    field_mapping = {
        "Název": "name",
        "Rok": "year",
        "Soutěž": "competition",
        "Tým": "team",
        "GitHub": "github",
        "Hardware": "hardware"
    }

    parsed = {}
    for czech_key, field_name in field_mapping.items():
        parsed[field_name] = data.get(czech_key, '').strip()

    # Validate mandatory fields (excluding hardware since it's optional in spirit, but we want to know if missing)
    required_fields = ["name", "year", "competition", "team", "github"]
    missing = [f for f in required_fields if not parsed.get(f)]
    if missing:
        print(f"Error: Missing required fields: {', '.join(missing)}")
        print(f"Parsed keys from markdown matches: {data}")
        return 1

    # Parse hardware tags into list
    raw_hardware = parsed.get("hardware", "")
    if raw_hardware and raw_hardware != "Žádné specifické vybavení":
        hardware_tags = [tag.strip() for tag in raw_hardware.split(",") if tag.strip()]
    else:
        hardware_tags = []

    # Ensure output directories exist
    os.makedirs("docs/data", exist_ok=True)
    os.makedirs("docs/images", exist_ok=True)

    # Search the entire body for an image URL
    img_url = extract_image_url(body)
    if not img_url:
        print("Error: Could not find any markdown image tag (or img tag) in the issue body.")
        return 1

    print(f"Downloading image from: {img_url}")
    
    # Send request with a real User-Agent to avoid issues with GitHub blocking simple scripts
    req = urllib.request.Request(
        img_url,
        headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    )
    
    try:
        with urllib.request.urlopen(req) as response:
            content_type = response.info().get('Content-Type', '')
            # Determine extension from content-type header, default to .png
            ext = '.png'
            if 'image/jpeg' in content_type or 'image/jpg' in content_type:
                ext = '.jpg'
            elif 'image/png' in content_type:
                ext = '.png'
            elif 'image/webp' in content_type:
                ext = '.webp'
            elif 'image/gif' in content_type:
                ext = '.gif'
            
            # Format filename using name slug and issue number
            slug = slugify(parsed["name"]) or "robot"
            image_filename = f"{slug}_{issue_number}{ext}"
            image_path = os.path.join("docs/images", image_filename)
            
            with open(image_path, 'wb') as out_file:
                out_file.write(response.read())
            print(f"Image successfully downloaded and saved to: {image_path}")
            
    except Exception as e:
        print(f"Error downloading image: {e}")
        return 1

    # Load existing robots.json
    robots_json_path = "docs/data/robots.json"
    robots_list = []
    if os.path.exists(robots_json_path):
        try:
            with open(robots_json_path, 'r', encoding='utf-8') as f:
                content = f.read().strip()
                if content:
                    robots_list = json.loads(content)
        except Exception as e:
            print(f"Warning: Could not read existing robots.json, starting fresh. Error: {e}")

    # Build new robot record
    new_robot = {
        "id": int(issue_number),
        "name": parsed["name"],
        "year": parsed["year"],
        "competition": parsed["competition"],
        "team": parsed["team"],
        "github": parsed["github"],
        "hardware": hardware_tags,
        "image": f"images/{image_filename}",
        "issue_url": issue_url
    }

    # Remove existing record with the same ID if it exists (for updates)
    robots_list = [r for r in robots_list if r.get("id") != new_robot["id"]]
    
    # Append the new robot
    robots_list.append(new_robot)
    
    # Sort robots by year (descending) and then name (ascending)
    def get_sort_key(r):
        year_str = str(r.get("year", ""))
        # Extract first 4 digits or set to empty
        match = re.search(r'\d{4}', year_str)
        year = int(match.group(0)) if match else 0
        return (-year, r.get("name", "").lower())
        
    robots_list.sort(key=get_sort_key)

    # Save to robots.json
    with open(robots_json_path, 'w', encoding='utf-8') as f:
        json.dump(robots_list, f, indent=2, ensure_ascii=False)
    print(f"Updated robots.json with: {parsed['name']}")

    # Write output variable for GitHub Actions
    github_output = os.environ.get('GITHUB_OUTPUT')
    if github_output:
        with open(github_output, 'a', encoding='utf-8') as f:
            f.write(f"robot_name={parsed['name']}\n")

    return 0

if __name__ == "__main__":
    import sys
    sys.exit(main())
