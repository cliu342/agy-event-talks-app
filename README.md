# BigQuery Release Notes Hub

An interactive web dashboard built with Python Flask and plain vanilla HTML, CSS, and JavaScript. The application fetches the official Google Cloud BigQuery release notes Atom feed, parses it, filters the notes by category, and provides a custom live-updating Tweet Composer to easily format and share specific release updates on X (formerly Twitter).

---

## 🌟 Key Features

* **Advanced XML Parser & Splitter:** Parses the Google Cloud BigQuery release notes XML feed and extracts individual items. Since Google packs multiple updates within a single day's feed entry, the backend splits them on `<h3>` boundary tags into individual structured cards.
* **1-Hour In-Memory Cache:** Caches responses locally to respect Google Cloud rate limits and ensure lightning-fast page loading. The cache can be manually bypassed by hitting "Refresh" on the UI.
* **Filter Dashboard:** Allows you to search keywords in real-time and toggle categories (`Feature`, `Announcement`, `Issue`, `Change`, `Breaking`). Interactive dashboard counters automatically calculate and display the number of entries for each group.
* **X / Twitter Share Suite:** Enables choosing any update from the feed. It strips the HTML markup, formats the text within the 280-character limit, attaches official source links and tags (`#BigQuery #GoogleCloud`), simulates a live feed preview, and launches X's Web Intent composer.
* **Glassmorphism UI:** Built with sleek responsive CSS containing ambient glow bubbles, modern Google Fonts (`Outfit` and `Inter`), and interactive cards.

---

## 📂 Project Structure

```
agy-event-talks-app/
├── app.py                  # Flask application (parsing, caching, splitting feed)
├── templates/
│   └── index.html          # Main HTML markup
├── static/
│   ├── css/
│   │   └── style.css       # Page styling, transitions, category colors, and layouts
│   └── js/
│       └── app.js          # Client states, filters, keyword matches, and tweet generation
├── .gitignore              # Ignores venv, pycache, OS metadata, and log files
└── README.md               # Project guide (this file)
```

---

## 🛠️ Installation & Setup

### Prerequisites
* **Python 3.9+** and **pip** installed.
* Standard terminal tool access.

### 1. Set Up Virtual Environment
Initialize and activate a virtual environment in the project directory:

```bash
# Create environment
python3 -m venv venv

# Activate on macOS / Linux
source venv/bin/activate
```

### 2. Install Dependencies
Install Flask and the `requests` library:

```bash
pip install flask requests
```

### 3. Run the Development Server
Launch the Flask development server:

```bash
python app.py
```
*(By default, the server is configured to run on port `5001` to avoid conflicting with macOS AirPlay services on port `5000`)*

### 4. Open in Browser
Navigate to:
👉 **[http://127.0.0.1:5001](http://127.0.0.1:5001)**

---

## 🐦 How to Tweet a Release Note

1. Click on any release card in your feed.
2. The **Tweet Composer** on the right side of the screen will dynamically slide in, showing a cleaned, pre-formatted draft and a live feed preview.
3. You can edit the text directly inside the textbox. A character counter and color-coded progress bar (turning amber and red) will keep track of the 280-character limit.
4. Click **Share on X / Twitter** to open a secure web intent window pre-loaded with your draft.

---

## 🛠️ Technologies Used

* **Backend:** Python, Flask, xml.etree.ElementTree (XML parser), Requests
* **Frontend:** Vanilla HTML5, Vanilla JavaScript (ES6+), Vanilla CSS3
* **Typography:** Outfit (headings), Inter (body)
* **Glow/Icons:** Custom Inline SVGs
