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

    # Parse hardware tags (comma-separated list, clean spaces)
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

    # Write output variable for GitHub Actions
    github_output = os.environ.get('GITHUB_OUTPUT')
    if github_output:
        with open(github_output, 'a', encoding='utf-8') as f:
            f.write(f"robot_name={parsed['name']}\n")

    # Close and label the issue
    if issue_number and issue_number != '0':
        close_and_label_issue(issue_number)

    return 0

if __name__ == "__main__":
    import sys
    sys.exit(main())
