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
    # 1. Match markdown format: ![alt_text](url)
    match = re.search(r'!\[.*?\]\((https?://[^\s)]+)\)', text)
    if match:
        return match.group(1)
    
    # 2. Match HTML format: <img src="url" ...>
    match = re.search(r'<img\s+[^>]*src=["\'](https?://[^"\']+)["\']', text)
    if match:
        return match.group(1)
    
    # 3. Match raw GitHub asset/attachment URLs or URLs with image extensions.
    # Ignore the repository URL under "- **GitHub**:"
    lines = text.split('\n')
    for line in lines:
        if line.strip().startswith("- **GitHub"):
            continue
        urls = re.findall(r'(https?://[^\s)]+)', line)
        for url in urls:
            is_github_upload = "/assets/" in url or "/user-attachments/" in url or "/uploads/" in url
            has_img_ext = any(url.lower().endswith(ext) for ext in ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'])
            if is_github_upload or has_img_ext:
                return url
    return None

def close_and_label_issue(issue_number):
    token = os.environ.get('GITHUB_TOKEN') or os.environ.get('GH_TOKEN')
    repo = os.environ.get('GITHUB_REPOSITORY')
    
    # Try using gh CLI first (pre-installed and pre-authenticated on GitHub runner if token is set)
    try:
        import subprocess
        # Check if gh CLI is available
        subprocess.run(["gh", "--version"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
        print("Closing issue using GitHub CLI...")
        # Add label 'zpracovano' and remove 'schvaleno'
        subprocess.run(["gh", "issue", "edit", str(issue_number), "--add-label", "zpracovano", "--remove-label", "schvaleno"], check=True)
        # Close issue
        subprocess.run(["gh", "issue", "close", str(issue_number)], check=True)
        print(f"Successfully closed and labeled issue #{issue_number} via GitHub CLI.")
        return True
    except Exception as cli_error:
        print(f"GitHub CLI method failed or not available: {cli_error}")
        
    # Fall back to direct REST API call if gh CLI is not available
    if not token or not repo:
        print("Warning: GITHUB_TOKEN/GH_TOKEN or GITHUB_REPOSITORY not set. Cannot use REST API to close issue.")
        return False
        
    print("Closing issue using GitHub REST API...")
    url = f"https://api.github.com/repos/{repo}/issues/{issue_number}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "Python-urllib"
    }
    
    try:
        # Fetch current labels to preserve others and modify 'schvaleno' / 'zpracovano'
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req) as response:
            issue_data = json.loads(response.read().decode('utf-8'))
            current_labels = [l['name'] for l in issue_data.get('labels', [])]
            
        new_labels = [l for l in current_labels if l != 'schvaleno']
        if 'zpracovano' not in new_labels:
            new_labels.append('zpracovano')
            
        data = {
            "state": "closed",
            "labels": new_labels
        }
        
        req = urllib.request.Request(
            url,
            data=json.dumps(data).encode('utf-8'),
            headers=headers,
            method='PATCH'
        )
        with urllib.request.urlopen(req) as response:
            if response.status == 200:
                print(f"Successfully closed and labeled issue #{issue_number} via REST API.")
                return True
    except Exception as api_error:
        print(f"GitHub REST API method failed: {api_error}")
        
    return False

def main():
    body = os.environ.get('ISSUE_BODY', '')
    issue_number = os.environ.get('ISSUE_NUMBER', '0')
    issue_url = os.environ.get('ISSUE_URL', '')

    if not body:
        print("Error: ISSUE_BODY environment variable is empty or not set.")
        return 1

    # Check if this is a deletion request
    is_deletion = "### Odstranění robota" in body or "Odstranění robota" in body

    if is_deletion:
        # Parse ID of robot to delete
        match = re.search(r'[-*]\s*\*\*ID\*\*\s*:\s*(\d+)', body)
        if not match:
            print("Error: Could not parse ID for deletion request in body.")
            return 1
        delete_id = int(match.group(1))

        # Load existing robots.json
        robots_json_path = "docs/data/robots.json"
        robots_list = []
        if os.path.exists(robots_json_path):
            try:
                with open(robots_json_path, 'r', encoding='utf-8') as f:
                    content = f.read().strip()
                    if content:
                        robots_list = json.loads(content)
                        if not isinstance(robots_list, list):
                            print(f"Error: robots.json content is not a list. Got: {type(robots_list)}")
                            return 1
            except Exception as e:
                print(f"Error: Could not read existing robots.json. Error: {e}")
                return 1

        # Find robot to delete to get its name and image path
        robot_to_delete = None
        for r in robots_list:
            if r.get("id") == delete_id:
                robot_to_delete = r
                break

        if not robot_to_delete:
            print(f"Warning: Robot with ID {delete_id} not found in the catalog.")
            deleted_robot_name = f"Robot #{delete_id}"
        else:
            deleted_robot_name = robot_to_delete.get("name", f"Robot #{delete_id}")
            # Delete image file if it exists
            img_path = robot_to_delete.get("image", "")
            if img_path:
                # The image path is stored as "images/filename.ext" relative to docs/
                full_img_path = os.path.join("docs", img_path)
                if os.path.exists(full_img_path) and os.path.isfile(full_img_path):
                    try:
                        os.remove(full_img_path)
                        print(f"Successfully deleted robot image: {full_img_path}")
                    except Exception as img_err:
                        print(f"Warning: Could not delete image file {full_img_path}. Error: {img_err}")

        # Filter out the robot to delete
        robots_list = [r for r in robots_list if r.get("id") != delete_id]

        # Save to robots.json
        with open(robots_json_path, 'w', encoding='utf-8') as f:
            json.dump(robots_list, f, indent=2, ensure_ascii=False)
        print(f"Successfully deleted robot: {deleted_robot_name} (ID: {delete_id})")

        # Write output variables for GitHub Actions
        github_output = os.environ.get('GITHUB_OUTPUT')
        if github_output:
            with open(github_output, 'a', encoding='utf-8') as f:
                f.write(f"robot_name={deleted_robot_name}\n")
                f.write(f"action_type=delete\n")

        # Close and label the issue
        if issue_number and issue_number != '0':
            close_and_label_issue(issue_number)

        return 0

    # Process ADD/UPDATE robot request
    # Parse key-value Markdown fields: - **Key**: Value
    data = {}
    for line in body.split('\n'):
        line = line.strip()
        match = re.match(r'^[-*]\s*\*\*(.*?)\*\*:\s*(.*)$', line)
        if match:
            key = match.group(1).strip()
            value = match.group(2).strip()
            data[key] = value

    # Map form Czech field names to our internal JSON keys
    field_mapping = {
        "Název": "name",
        "Rok": "year",
        "Soutěž": "competition",
        "Tým": "team",
        "GitHub": "github",
        "Vývojová deska": "board",
        "Jazyk": "language",
        "Hardware": "hardware"
    }

    parsed = {}
    for czech_key, field_name in field_mapping.items():
        parsed[field_name] = data.get(czech_key, '').strip()

    # Validate mandatory fields
    required_fields = ["name", "year", "competition", "team", "github"]
    missing = [f for f in required_fields if not parsed.get(f)]
    if missing:
        print(f"Error: Missing required fields: {', '.join(missing)}")
        print(f"Parsed keys from markdown matches: {data}")
        return 1

    # Parse team members (comma-separated list, clean spaces)
    raw_team = parsed.get("team", "")
    team_members = [member.strip() for member in raw_team.split(",") if member.strip()]
    cleaned_team = ", ".join(team_members)

    # Parse board tags (comma-separated list, clean spaces)
    raw_board = parsed.get("board", "")
    if raw_board and raw_board not in ("Žádná specifická deska", "None"):
        board_tags = [tag.strip() for tag in raw_board.split(",") if tag.strip()]
    else:
        board_tags = []

    # Parse language tags (comma-separated list, clean spaces)
    raw_language = parsed.get("language", "")
    if raw_language and raw_language not in ("Žádný specifický jazyk", "None"):
        language_tags = [tag.strip() for tag in raw_language.split(",") if tag.strip()]
    else:
        language_tags = []

    # Parse hardware tags (comma-separated list, clean spaces)
    raw_hardware = parsed.get("hardware", "")
    if raw_hardware and raw_hardware not in ("Žádné specifické vybavení", "None"):
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
            image_data = response.read()
            
            # Format filename using name slug and issue number
            slug = slugify(parsed["name"]) or "robot"
            image_filename = f"{slug}_{issue_number}.webp"
            image_path = os.path.join("docs/images", image_filename)
            
            # Save downloaded image temporarily to process
            temp_path = image_path + ".tmp"
            with open(temp_path, 'wb') as out_file:
                out_file.write(image_data)
                
            try:
                from PIL import Image
                with Image.open(temp_path) as img:
                    # Convert mode to RGB or RGBA depending on transparency
                    if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
                        if img.mode != "RGBA":
                            img = img.convert("RGBA")
                    elif img.mode != "RGB":
                        img = img.convert("RGB")
                    
                    # Resize if too large (e.g., max width/height of 1000px)
                    max_size = 1000
                    width, height = img.size
                    if width > max_size or height > max_size:
                        if width > height:
                            new_height = int(height * (max_size / width))
                            new_width = max_size
                        else:
                            new_width = int(width * (max_size / height))
                            new_height = max_size
                        img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
                        
                    # Save as WebP with optimized quality
                    img.save(image_path, "WEBP", quality=80)
                print(f"Image successfully converted, optimized to WebP, and saved to: {image_path}")
            except Exception as img_err:
                print(f"Pillow optimization failed: {img_err}. Saving original image instead.")
                content_type = response.info().get('Content-Type', '')
                fallback_ext = '.png'
                if 'image/jpeg' in content_type or 'image/jpg' in content_type:
                    fallback_ext = '.jpg'
                elif 'image/webp' in content_type:
                    fallback_ext = '.webp'
                elif 'image/gif' in content_type:
                    fallback_ext = '.gif'
                
                image_filename = f"{slug}_{issue_number}{fallback_ext}"
                image_path = os.path.join("docs/images", image_filename)
                os.rename(temp_path, image_path)
                print(f"Saved original fallback image to: {image_path}")
            finally:
                if os.path.exists(temp_path):
                    try:
                        os.remove(temp_path)
                    except:
                        pass
            
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
                    if not isinstance(robots_list, list):
                        print(f"Error: robots.json content is not a list. Got: {type(robots_list)}")
                        return 1
        except Exception as e:
            print(f"Error: Could not read existing robots.json. Error: {e}")
            return 1

    # Build new robot record
    new_robot = {
        "id": int(issue_number),
        "name": parsed["name"],
        "year": parsed["year"],
        "competition": parsed["competition"],
        "team": cleaned_team,
        "github": parsed["github"],
        "board": board_tags,
        "language": language_tags,
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
        match = re.search(r'\d{4}', year_str)
        year = int(match.group(0)) if match else 0
        return (-year, r.get("name", "").lower())
        
    robots_list.sort(key=get_sort_key)

    # Save to robots.json
    with open(robots_json_path, 'w', encoding='utf-8') as f:
        json.dump(robots_list, f, indent=2, ensure_ascii=False)
    print(f"Updated robots.json with: {parsed['name']}")

    # Write output variables for GitHub Actions
    github_output = os.environ.get('GITHUB_OUTPUT')
    if github_output:
        with open(github_output, 'a', encoding='utf-8') as f:
            f.write(f"robot_name={parsed['name']}\n")
            f.write(f"action_type=add\n")

    # Close and label the issue
    if issue_number and issue_number != '0':
        close_and_label_issue(issue_number)

    return 0

if __name__ == "__main__":
    import sys
    sys.exit(main())
