// --- App State ---
let state = {
    releaseNotes: [],
    filteredNotes: [],
    selectedNote: null,
    activeCategory: 'all',
    searchQuery: '',
    lastFetchedTime: null
};

// --- DOM Elements ---
const elements = {
    btnRefresh: document.getElementById('btn-refresh'),
    spinnerIcon: document.getElementById('spinner-icon'),
    syncStatus: document.getElementById('sync-status'),
    
    // Stats
    statTotal: document.getElementById('stat-total'),
    statFeatures: document.getElementById('stat-features'),
    statBreaking: document.getElementById('stat-breaking'),
    statChanges: document.getElementById('stat-changes'),
    statCards: document.querySelectorAll('.stat-card'),
    
    // Search & Filters
    searchInput: document.getElementById('search-input'),
    btnClearSearch: document.getElementById('btn-clear-search'),
    categoryFilters: document.getElementById('category-filters'),
    btnExportCSV: document.getElementById('btn-export-csv'),
    
    // Feed States
    feedContainer: document.getElementById('feed-container'),
    loadingState: document.getElementById('loading-state'),
    errorState: document.getElementById('error-state'),
    errorMessage: document.getElementById('error-message'),
    emptyState: document.getElementById('empty-state'),
    btnRetry: document.getElementById('btn-retry'),
    
    // Composer
    composerEmpty: document.getElementById('composer-empty'),
    composerForm: document.getElementById('composer-form'),
    composerBadgeCategory: document.getElementById('composer-badge-category'),
    composerBadgeDate: document.getElementById('composer-badge-date'),
    tweetTextarea: document.getElementById('tweet-textarea'),
    charCounter: document.getElementById('char-counter'),
    charProgress: document.getElementById('char-progress'),
    charWarning: document.getElementById('char-warning'),
    tweetPreviewText: document.getElementById('tweet-preview-text'),
    btnShareTweet: document.getElementById('btn-share-tweet'),
    
    // Theme Toggle
    btnThemeToggle: document.getElementById('btn-theme-toggle'),
    themeSunIcon: document.getElementById('theme-sun-icon'),
    themeMoonIcon: document.getElementById('theme-moon-icon')
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    restoreTheme();
    initEventListeners();
    fetchReleaseNotes(false);
});

// --- Event Listeners Setup ---
function initEventListeners() {
    // Refresh buttons
    elements.btnRefresh.addEventListener('click', () => fetchReleaseNotes(true));
    elements.btnRetry.addEventListener('click', () => fetchReleaseNotes(true));
    
    // CSV Export Button
    elements.btnExportCSV.addEventListener('click', exportToCSV);
    
    // Theme Toggle
    elements.btnThemeToggle.addEventListener('click', toggleTheme);
    
    // Category Filter pills
    elements.categoryFilters.addEventListener('click', (e) => {
        const pill = e.target.closest('.pill');
        if (!pill) return;
        
        // Toggle active class
        elements.categoryFilters.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        
        state.activeCategory = pill.dataset.category;
        applyFilters();
    });
    
    // Quick Stats click filters
    elements.statCards.forEach(card => {
        card.addEventListener('click', () => {
            const statType = card.dataset.stat;
            let targetCategory = 'all';
            
            if (statType === 'feature') targetCategory = 'feature';
            else if (statType === 'breaking') targetCategory = 'breaking';
            else if (statType === 'change') targetCategory = 'change';
            
            // Highlight appropriate pill
            elements.categoryFilters.querySelectorAll('.pill').forEach(pill => {
                if (pill.dataset.category === targetCategory) {
                    pill.click();
                }
            });
        });
    });
    
    // Search input interactions
    elements.searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value.toLowerCase().trim();
        elements.btnClearSearch.style.display = state.searchQuery ? 'block' : 'none';
        applyFilters();
    });
    
    elements.btnClearSearch.addEventListener('click', () => {
        elements.searchInput.value = '';
        state.searchQuery = '';
        elements.btnClearSearch.style.display = 'none';
        elements.searchInput.focus();
        applyFilters();
    });
    
    // Tweet composer input interaction
    elements.tweetTextarea.addEventListener('input', updateTweetComposerStatus);
    
    // Share Button action
    elements.btnShareTweet.addEventListener('click', publishTweet);
}

// --- API Fetching ---
async function fetchReleaseNotes(forceRefresh = false) {
    showLoading(true);
    showError(false);
    
    try {
        const url = `/api/release-notes${forceRefresh ? '?refresh=true' : ''}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Server returned HTTP ${response.status}`);
        }
        
        const result = await response.json();
        if (result.status === 'error') {
            throw new Error(result.message);
        }
        
        state.releaseNotes = result.data;
        state.lastFetchedTime = result.last_fetched;
        
        // Update stats dashboard
        tallyStats(state.releaseNotes);
        
        // Update updated label
        updateSyncTimeLabel(state.lastFetchedTime);
        
        // Render
        applyFilters();
        
    } catch (err) {
        console.error('Fetch error:', err);
        elements.errorMessage.textContent = err.message || 'Unable to connect to release notes service.';
        showError(true);
    } finally {
        showLoading(false);
    }
}

// --- Data Filtering and Processing ---
function applyFilters() {
    state.filteredNotes = state.releaseNotes.filter(note => {
        // 1. Category check
        const noteCat = note.category.toLowerCase();
        let matchesCategory = false;
        
        if (state.activeCategory === 'all') {
            matchesCategory = true;
        } else if (state.activeCategory === 'breaking') {
            // Group breaking and issues together in this statistical filter
            matchesCategory = (noteCat === 'breaking' || noteCat === 'issue');
        } else if (state.activeCategory === 'change') {
            // Group change and announcement together
            matchesCategory = (noteCat === 'change' || noteCat === 'announcement');
        } else {
            matchesCategory = (noteCat === state.activeCategory);
        }
        
        // 2. Keyword Search check
        let matchesSearch = true;
        if (state.searchQuery) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = note.html;
            const plainText = tempDiv.textContent.toLowerCase();
            
            matchesSearch = note.category.toLowerCase().includes(state.searchQuery) ||
                            note.date.toLowerCase().includes(state.searchQuery) ||
                            plainText.includes(state.searchQuery);
        }
        
        return matchesCategory && matchesSearch;
    });
    
    renderFeed();
}

// --- UI Rendering ---
function renderFeed() {
    elements.feedContainer.innerHTML = '';
    
    if (state.filteredNotes.length === 0) {
        elements.emptyState.style.display = 'flex';
        return;
    }
    
    elements.emptyState.style.display = 'none';
    
    // Group notes by date
    const groupedByDate = {};
    state.filteredNotes.forEach(note => {
        if (!groupedByDate[note.date]) {
            groupedByDate[note.date] = [];
        }
        groupedByDate[note.date].push(note);
    });
    
    // Render grouped dates
    for (const date in groupedByDate) {
        // Date Header
        const dateHeader = document.createElement('div');
        dateHeader.className = 'date-group-header';
        dateHeader.textContent = date;
        elements.feedContainer.appendChild(dateHeader);
        
        // Cards for this date
        groupedByDate[date].forEach(note => {
            const card = document.createElement('div');
            card.className = 'release-card';
            card.dataset.id = note.id;
            card.dataset.category = note.category.toLowerCase();
            
            if (state.selectedNote && state.selectedNote.id === note.id) {
                card.classList.add('selected');
            }
            
            const badgeClass = getBadgeClass(note.category);
            
            card.innerHTML = `
                <div class="card-header">
                    <span class="badge ${badgeClass}">${note.category}</span>
                    <span class="card-date">${note.date}</span>
                </div>
                <div class="card-content">
                    ${note.html}
                </div>
                <div class="card-footer" style="display: flex; gap: 0.55rem; justify-content: flex-end; width: 100%;">
                    <button class="btn-copy-clipboard" title="Copy text to clipboard">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                        <span>Copy</span>
                    </button>
                    <button class="btn-select-tweet">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M12 20h9"></path>
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                        </svg>
                        <span>Select to Tweet</span>
                    </button>
                </div>
            `;
            
            // Bind Copy click event
            const btnCopy = card.querySelector('.btn-copy-clipboard');
            btnCopy.addEventListener('click', (e) => {
                e.stopPropagation(); // Stop click from selecting card
                copyCardToClipboard(note, card);
            });
            
            // Add click interaction to select card
            card.addEventListener('click', (e) => {
                // If user clicks a link inside the content, let the browser open the link normally
                if (e.target.tagName === 'A' || e.target.closest('a')) {
                    return;
                }
                
                selectReleaseNote(note);
            });
            
            elements.feedContainer.appendChild(card);
        });
    }
}

// --- Tweet Selection & Composer Logic ---
function selectReleaseNote(note) {
    state.selectedNote = note;
    
    // Highlight active card
    document.querySelectorAll('.release-card').forEach(card => {
        if (card.dataset.id === note.id) {
            card.classList.add('selected');
        } else {
            card.classList.remove('selected');
        }
    });
    
    // Transition Composer sidebar from empty state to form state
    elements.composerEmpty.style.display = 'none';
    elements.composerForm.style.display = 'flex';
    
    // Set headers
    elements.composerBadgeCategory.textContent = note.category;
    elements.composerBadgeCategory.className = `badge ${getBadgeClass(note.category)}`;
    elements.composerBadgeDate.textContent = note.date;
    
    // Generate default tweet text
    const defaultText = generateDefaultTweetText(note);
    elements.tweetTextarea.value = defaultText;
    
    // Update live previews and counters
    updateTweetComposerStatus();
}

function generateDefaultTweetText(note) {
    // Strip HTML to get clean text
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = note.html;
    let plainText = tempDiv.textContent || tempDiv.innerText || "";
    
    // Collapse extra whitespace and newlines
    plainText = plainText.replace(/\s+/g, ' ').trim();
    
    const prefix = `📢 BigQuery ${note.category} (${note.date}):\n`;
    
    // Fallback URL if note.link is missing
    const sourceLink = note.link || 'https://docs.cloud.google.com/bigquery/docs/release-notes';
    const suffix = `\n\nSource: ${sourceLink}\n#BigQuery #GoogleCloud`;
    
    // Check total character length (max 280)
    const allowedLength = 280 - prefix.length - suffix.length;
    
    if (plainText.length > allowedLength) {
        // Subtract 3 characters for trailing "..."
        plainText = plainText.substring(0, allowedLength - 3) + '...';
    }
    
    return `${prefix}${plainText}${suffix}`;
}

function updateTweetComposerStatus() {
    const text = elements.tweetTextarea.value;
    const len = text.length;
    
    // Counter display
    elements.charCounter.textContent = `${len} / 280`;
    
    // Progress meter width
    const percentage = Math.min((len / 280) * 100, 100);
    elements.charProgress.style.width = `${percentage}%`;
    
    // Progress meter colors
    if (len > 280) {
        elements.charProgress.style.backgroundColor = '#ef4444'; // Red
        elements.charWarning.style.display = 'block';
        elements.btnShareTweet.disabled = true;
        elements.btnShareTweet.style.opacity = 0.5;
        elements.btnShareTweet.style.pointerEvents = 'none';
    } else {
        elements.charWarning.style.display = 'none';
        elements.btnShareTweet.disabled = false;
        elements.btnShareTweet.style.opacity = 1;
        elements.btnShareTweet.style.pointerEvents = 'auto';
        
        if (len > 250) {
            elements.charProgress.style.backgroundColor = '#f59e0b'; // Amber warning
        } else {
            elements.charProgress.style.backgroundColor = 'var(--color-primary)'; // Blue default
        }
    }
    
    // Update live text feed simulation
    elements.tweetPreviewText.textContent = text;
}

function publishTweet() {
    const tweetText = elements.tweetTextarea.value;
    if (tweetText.length > 280) {
        alert('Your draft exceeds 280 characters. Please shorten it before posting.');
        return;
    }
    
    // Open Twitter Web Intent
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
    window.open(url, '_blank', 'width=600,height=400,resizable=yes');
}

// --- Helpers ---
function getBadgeClass(category) {
    const cat = category.toLowerCase();
    if (cat === 'feature') return 'badge-feature';
    if (cat === 'announcement') return 'badge-announcement';
    if (cat === 'issue') return 'badge-issue';
    if (cat === 'change') return 'badge-change';
    if (cat === 'breaking') return 'badge-breaking';
    return 'badge-default';
}

function tallyStats(notes) {
    let features = 0;
    let breaking = 0;
    let changes = 0;
    
    notes.forEach(note => {
        const cat = note.category.toLowerCase();
        if (cat === 'feature') features++;
        else if (cat === 'breaking' || cat === 'issue') breaking++;
        else if (cat === 'change' || cat === 'announcement') changes++;
    });
    
    elements.statTotal.textContent = notes.length;
    elements.statFeatures.textContent = features;
    elements.statBreaking.textContent = breaking;
    elements.statChanges.textContent = changes;
}

function updateSyncTimeLabel(timestamp) {
    if (!timestamp) {
        elements.syncStatus.textContent = 'Not synced';
        return;
    }
    const date = new Date(timestamp * 1000);
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    elements.syncStatus.textContent = `Last fetched: ${timeStr}`;
}

function showLoading(isLoading) {
    if (isLoading) {
        elements.loadingState.style.display = 'flex';
        elements.spinnerIcon.classList.add('spinning');
        elements.btnRefresh.disabled = true;
    } else {
        elements.loadingState.style.display = 'none';
        elements.spinnerIcon.classList.remove('spinning');
        elements.btnRefresh.disabled = false;
    }
}

function showError(isError) {
    elements.errorState.style.display = isError ? 'flex' : 'none';
    if (isError) {
        elements.feedContainer.innerHTML = '';
        elements.emptyState.style.display = 'none';
    }
}

// --- Copy Card Content to Clipboard ---
function copyCardToClipboard(note, cardElement) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = note.html;
    let plainText = tempDiv.textContent || tempDiv.innerText || "";
    plainText = plainText.replace(/\s+/g, ' ').trim();
    
    const sourceLink = note.link || 'https://docs.cloud.google.com/bigquery/docs/release-notes';
    const clipboardText = `BigQuery Release Note - ${note.category} (${note.date})\n\n${plainText}\n\nSource: ${sourceLink}`;
    
    const btn = cardElement.querySelector('.btn-copy-clipboard');
    const btnSpan = btn.querySelector('span');
    
    navigator.clipboard.writeText(clipboardText).then(() => {
        btn.classList.add('copied');
        btnSpan.textContent = 'Copied!';
        
        setTimeout(() => {
            btn.classList.remove('copied');
            btnSpan.textContent = 'Copy';
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy text: ', err);
        alert('Failed to copy to clipboard. Please try manually selecting the text.');
    });
}

// --- Export Filtered Notes to CSV ---
function exportToCSV() {
    if (state.filteredNotes.length === 0) {
        alert('There are no updates matching your current filters to export.');
        return;
    }
    
    // Helper to format values for CSV, enclosing in double quotes and escaping inner quotes
    const escapeCSVField = (val) => {
        if (val === null || val === undefined) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
    };
    
    // CSV Header row
    let csvContent = 'ID,Date,Category,Link,Content\r\n';
    
    state.filteredNotes.forEach(note => {
        // Extract clean plain text for the content column (strip HTML tags)
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = note.html;
        let plainContent = tempDiv.textContent || tempDiv.innerText || "";
        plainContent = plainContent.replace(/\s+/g, ' ').trim();
        
        const row = [
            note.id,
            note.date,
            note.category,
            note.link,
            plainContent
        ].map(escapeCSVField).join(',');
        
        csvContent += row + '\r\n';
    });
    
    // Create download trigger
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    // Generate filename based on filters
    const categorySuffix = state.activeCategory !== 'all' ? `_${state.activeCategory}` : '';
    const searchSuffix = state.searchQuery ? `_filtered` : '';
    const dateStamp = new Date().toISOString().slice(0, 10);
    const filename = `bigquery_release_notes_${dateStamp}${categorySuffix}${searchSuffix}.csv`;
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// --- Theme Toggle ---
function toggleTheme() {
    const isLight = document.body.classList.toggle('light-mode');
    updateThemeIcons(isLight);
    localStorage.setItem('bq-release-hub-theme', isLight ? 'light' : 'dark');
}

function restoreTheme() {
    const savedTheme = localStorage.getItem('bq-release-hub-theme');
    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
        updateThemeIcons(true);
    }
}

function updateThemeIcons(isLight) {
    // In dark mode: show Sun icon (to switch to light)
    // In light mode: show Moon icon (to switch to dark)
    elements.themeSunIcon.style.display = isLight ? 'none' : 'block';
    elements.themeMoonIcon.style.display = isLight ? 'block' : 'none';
}
