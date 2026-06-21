import os
import re
import time
import requests
import xml.etree.ElementTree as ET
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

# Constants
FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
CACHE_TIMEOUT = 3600  # 1 hour cache

# Global cache structure
feed_cache = {
    "data": None,
    "last_fetched": 0
}

def split_content_to_items(content_html):
    """
    Splits the entry's HTML content by <h3> category headers to separate different release note updates on the same date.
    Returns a list of dictionaries with 'category' and 'html' keys.
    """
    # Find all h3 tags
    matches = list(re.finditer(r'<h3>(.*?)</h3>', content_html, re.IGNORECASE))
    if not matches:
        return [{"category": "Update", "html": content_html}]
    
    items = []
    for i, match in enumerate(matches):
        category = match.group(1).strip()
        start = match.end()
        # The content for this category ends where the next <h3> match starts, or at the end of the string
        end = matches[i+1].start() if i + 1 < len(matches) else len(content_html)
        item_html = content_html[start:end].strip()
        items.append({
            "category": category,
            "html": item_html
        })
    return items

def fetch_and_parse_feed(force_refresh=False):
    global feed_cache
    now = time.time()
    
    # Return cache if valid and refresh not forced
    if not force_refresh and feed_cache["data"] is not None and (now - feed_cache["last_fetched"]) < CACHE_TIMEOUT:
        return feed_cache["data"]
    
    # Fetch XML feed
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
    response = requests.get(FEED_URL, headers=headers, timeout=15)
    response.raise_for_status()
    xml_content = response.text
    
    # Parse XML structure
    root = ET.fromstring(xml_content)
    
    # Namespace dictionary for Atom feed tags
    ns = {'atom': 'http://www.w3.org/2005/Atom'}
    
    entries = []
    for entry_elem in root.findall('atom:entry', ns):
        # Title of the entry holds the release date (e.g. "June 17, 2026")
        title_elem = entry_elem.find('atom:title', ns)
        date_str = title_elem.text if title_elem is not None else "Unknown Date"
        
        id_elem = entry_elem.find('atom:id', ns)
        entry_id = id_elem.text if id_elem is not None else ""
        
        updated_elem = entry_elem.find('atom:updated', ns)
        updated_str = updated_elem.text if updated_elem is not None else ""
        
        link_elem = entry_elem.find('atom:link', ns)
        link = link_elem.attrib.get('href') if link_elem is not None else ""
        
        content_elem = entry_elem.find('atom:content', ns)
        content_html = content_elem.text if content_elem is not None else ""
        
        # Split HTML content by category <h3> headings
        split_items = split_content_to_items(content_html)
        
        for index, item in enumerate(split_items):
            # Create a unique ID for this item (sanitize characters)
            item_id = f"{entry_id}_{index}"
            item_id = re.sub(r'[^a-zA-Z0-9_]', '_', item_id)
            
            entries.append({
                "id": item_id,
                "date": date_str,
                "updated": updated_str,
                "link": link,
                "category": item["category"],
                "html": item["html"]
            })
            
    feed_cache["data"] = entries
    feed_cache["last_fetched"] = now
    return entries

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/release-notes')
def get_release_notes():
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    try:
        data = fetch_and_parse_feed(force_refresh=force_refresh)
        return jsonify({
            "status": "success",
            "count": len(data),
            "last_fetched": feed_cache["last_fetched"],
            "data": data
        })
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

if __name__ == '__main__':
    # Using 5001 because port 5000 is often taken by AirPlay on macOS
    app.run(host='0.0.0.0', port=5001, debug=True)
