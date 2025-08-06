/**
 * NC File Converter Search Module
 * Handles search functionality in the preview panels
 */

NCConverter.Search = {
  // Search state
  searchMatches: [],
  currentMatchIndex: -1,
  
  // Cache DOM elements
  elements: {},
  
  // Search worker for background processing
  searchWorker: null,
  
  // Debounce timer reference
  searchDebounceTimer: null,
  
  /**
   * Initialize the search module
   */
  init: function() {
    // Cache DOM elements for better performance
    this.elements = {
      searchInput: document.getElementById('previewSearchInput'),
      searchBtn: document.getElementById('previewSearchBtn'),
      prevMatchBtn: document.getElementById('prevMatchBtn'),
      nextMatchBtn: document.getElementById('nextMatchBtn'),
      searchCaseSensitive: document.getElementById('searchCaseSensitive'),
      searchResultsInfo: document.getElementById('searchResultsInfo'),
      originalPreview: document.getElementById('originalPreview')
    };
    
    const { searchInput, searchBtn, prevMatchBtn, nextMatchBtn, searchCaseSensitive } = this.elements;
    
    if (!searchInput || !searchBtn || !prevMatchBtn || !nextMatchBtn) {
      console.warn('Search elements not found');
      return;
    }
    
    // Initialize search worker
    this.initSearchWorker();
    
    // Search event listeners
    searchBtn.addEventListener('click', this.performSearch.bind(this));
    
    // Add input event listener with debounce for live search
    searchInput.addEventListener('input', this.debounceSearch.bind(this, 300));
    
    // Enter key in search input
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.performSearch();
      }
    });
    
    // Navigation buttons
    prevMatchBtn.addEventListener('click', () => this.navigateSearch(-1));
    nextMatchBtn.addEventListener('click', () => this.navigateSearch(1));
    
    // Case sensitive toggle
    if (searchCaseSensitive) {
      searchCaseSensitive.addEventListener('change', () => {
        if (searchInput.value.trim()) this.performSearch();
      });
    }
    
    console.log('Search module initialized');
  },
  
  /**
   * Initialize the search worker for background processing
   */
  initSearchWorker: function() {
    try {
      // Create a worker from a blob to avoid external file dependencies
      const workerCode = [
        'self.onmessage = function(e) {',
        '  const { text, searchTerm, caseSensitive } = e.data;',
        '  ',
        '  if (!text || !searchTerm) {',
        '    self.postMessage({ matches: [] });',
        '    return;',
        '  }',
        '  ',
        '  const matches = [];',
        '  const flags = caseSensitive ? \'g\' : \'gi\';',
        '  const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\\]\\\\]/g, \'\\\\$&\');',
        '  const regex = new RegExp(escapedTerm, flags);',
        '  ',
        '  let match;',
        '  while ((match = regex.exec(text)) !== null) {',
        '    matches.push({',
        '      start: match.index,',
        '      end: match.index + match[0].length,',
        '      text: match[0]',
        '    });',
        '  }',
        '  ',
        '  self.postMessage({ matches });',
        '};'
      ].join('\n');
      
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      
      this.searchWorker = new Worker(workerUrl);
      
      // Handle worker responses
      this.searchWorker.onmessage = (e) => {
        const { matches } = e.data;
        this.searchMatches = matches;
        
        // Update UI with matches
        this.updateSearchUI();
        
        // If matches found, highlight them
        if (matches.length > 0) {
          this.highlightMatches();
          this.currentMatchIndex = 0;
          this.updateCurrentMatch();
        }
      };
      
      // Handle worker errors
      this.searchWorker.onerror = (error) => {
        console.error('Search worker error:', error);
        
        // Fall back to main thread search
        this.searchInMainThread();
      };
      
      // Clean up URL object
      URL.revokeObjectURL(workerUrl);
    } catch (error) {
      console.error('Failed to initialize search worker:', error);
      
      // Worker creation failed, but we'll fall back to main thread search when needed
      this.searchWorker = null;
    }
  },
  
  /**
   * Debounce search to avoid too many searches while typing
   * @param {number} delay - Debounce delay in milliseconds
   */
  debounceSearch: function(delay) {
    // Cancel previous timeout
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
    
    // Set new timeout
    this.searchDebounceTimer = setTimeout(() => {
      const searchTerm = this.elements.searchInput.value.trim();
      
      // Only search if we have a term with at least 2 characters
      if (searchTerm.length >= 2) {
        this.performSearch();
      } else if (searchTerm.length === 0) {
        // Clear if search is empty
        this.clearSearchHighlights();
      }
    }, delay);
  },
  
  /**
   * Get fresh DOM references for preview elements (in case tab was regenerated)
   */
  getPreviewElements: function() {
    return {
      originalPreview: document.getElementById('originalPreview'),
      convertedPreview: document.getElementById('convertedPreview')
    };
  },

  /**
   * Perform search in the converted preview
   */
  performSearch: function() {
    const { searchInput, searchCaseSensitive } = this.elements;
    const { originalPreview } = this.getPreviewElements(); // Get fresh reference
    
    if (!searchInput || !originalPreview) {
      console.warn('Search elements missing');
      return;
    }
    
    const searchTerm = searchInput.value.trim();
    if (!searchTerm) {
      this.clearSearchHighlights();
      return;
    }
    
    // Reset current matches
    this.clearSearchHighlights();
    this.searchMatches = [];
    this.currentMatchIndex = -1;
    
    // Get text content from the preview div
    const textContent = this.getPreviewTextContent();
    
    // Use worker if available
    if (this.searchWorker) {
      this.searchWorker.postMessage({
        text: textContent,
        searchTerm: searchTerm,
        caseSensitive: searchCaseSensitive ? searchCaseSensitive.checked : false
      });
    } else {
      // Fall back to main thread search
      this.searchInMainThread();
    }
  },
  
  /**
   * Get the text content from the preview element
   * @return {string} Text content
   */
  getPreviewTextContent: function() {
    const { originalPreview } = this.getPreviewElements(); // Get fresh reference
    if (!originalPreview) return '';
    
    // Create a temporary div to parse the HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = originalPreview.innerHTML;
    
    // Get the text content
    return tempDiv.textContent || tempDiv.innerText || '';
  },
  
  /**
   * Perform search in the main thread (fallback)
   */
  searchInMainThread: function() {
    const { searchInput, searchCaseSensitive, searchResultsInfo } = this.elements;
    const { originalPreview } = this.getPreviewElements(); // Get fresh reference
    
    if (!searchInput || !originalPreview || !searchResultsInfo) return;
    
    const searchTerm = searchInput.value.trim();
    if (!searchTerm) return;
    
    const textContent = this.getPreviewTextContent();
    
    // Find all matches
    const caseSensitive = searchCaseSensitive && searchCaseSensitive.checked;
    const flags = caseSensitive ? 'g' : 'gi';
    const regex = new RegExp(this.escapeRegExp(searchTerm), flags);
    
    const matches = [];
    let match;
    
    while ((match = regex.exec(textContent)) !== null) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        text: match[0]
      });
    }
    
    this.searchMatches = matches;
    
    // Update UI with matches
    this.updateSearchUI();
    
    // If matches found, highlight them
    if (matches.length > 0) {
      this.highlightMatches();
      this.currentMatchIndex = 0;
      this.updateCurrentMatch();
    }
  },
  
  /**
   * Update search UI elements
   */
  updateSearchUI: function() {
    const { prevMatchBtn, nextMatchBtn, searchResultsInfo } = this.elements;
    
    if (!searchResultsInfo) return;
    
    // Update search results info
    if (this.searchMatches.length === 0) {
      searchResultsInfo.textContent = 'No matches found';
      if (prevMatchBtn) prevMatchBtn.disabled = true;
      if (nextMatchBtn) nextMatchBtn.disabled = true;
      return;
    }
    
    // Update buttons
    if (prevMatchBtn) prevMatchBtn.disabled = false;
    if (nextMatchBtn) nextMatchBtn.disabled = false;
    
    // Update results info
    searchResultsInfo.textContent = `Match ${this.currentMatchIndex + 1} of ${this.searchMatches.length}`;
  },
  
  /**
   * Highlight all search matches in the converted preview
   */
  highlightMatches: function() {
    const { originalPreview } = this.getPreviewElements(); // Get fresh reference
    if (!originalPreview || this.searchMatches.length === 0) return;
    
    // Create a document fragment for better performance
    const fragment = document.createDocumentFragment();
    const container = document.createElement('div');
    container.innerHTML = originalPreview.innerHTML;
    
    // Use a more efficient method to highlight matches
    this.highlightMatchesInNodes(container);
    
    // Update preview with highlighted content
    originalPreview.innerHTML = container.innerHTML;
  },
  
  /**
   * Recursively highlight matches in DOM nodes
   * @param {Node} node - Node to process
   */
  highlightMatchesInNodes: function(node) {
    // Walk the DOM tree recursively to find and highlight text nodes
    if (node.nodeType === Node.TEXT_NODE) {
      // Process text node
      this.highlightMatchesInTextNode(node);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      // Process element node (recursively)
      for (let i = 0; i < node.childNodes.length; i++) {
        this.highlightMatchesInNodes(node.childNodes[i]);
      }
    }
  },
  
  /**
   * Highlight matches in a text node
   * @param {Node} textNode - Text node to process
   */
  highlightMatchesInTextNode: function(textNode) {
    const text = textNode.nodeValue;
    const { searchInput, searchCaseSensitive } = this.elements;
    
    if (!text || !searchInput) return;
    
    const searchTerm = searchInput.value.trim();
    if (!searchTerm) return;
    
    // Find all matches in this text node
    const caseSensitive = searchCaseSensitive && searchCaseSensitive.checked;
    const flags = caseSensitive ? 'g' : 'gi';
    const regex = new RegExp(this.escapeRegExp(searchTerm), flags);
    
    // Skip if no matches in this node
    if (!regex.test(text)) return;
    
    // Reset regex
    regex.lastIndex = 0;
    
    // Get all matches
    const matches = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        text: match[0]
      });
    }
    
    if (matches.length === 0) return;
    
    // Replace the text node with highlighted spans
    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      
      // Add text before the match
      if (match.start > lastIndex) {
        fragment.appendChild(document.createTextNode(
          text.substring(lastIndex, match.start)
        ));
      }
      
      // Add highlighted match
      const highlightSpan = document.createElement('span');
      highlightSpan.className = 'search-match';
      highlightSpan.dataset.matchIndex = this.findGlobalMatchIndex(match);
      highlightSpan.textContent = match.text;
      fragment.appendChild(highlightSpan);
      
      // Update last index
      lastIndex = match.end;
    }
    
    // Add remaining text after last match
    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(
        text.substring(lastIndex)
      ));
    }
    
    // Replace the original text node with our fragment
    textNode.parentNode.replaceChild(fragment, textNode);
  },
  
  /**
   * Find the global index of a match
   * @param {Object} localMatch - Match object with start/end/text
   * @return {number} Global match index or -1 if not found
   */
  findGlobalMatchIndex: function(localMatch) {
    for (let i = 0; i < this.searchMatches.length; i++) {
      const globalMatch = this.searchMatches[i];
      if (globalMatch.start === localMatch.start && globalMatch.end === localMatch.end) {
        return i;
      }
    }
    return -1;
  },
  
  /**
   * Navigate between search matches
   * @param {number} direction - Direction to move (1 for next, -1 for previous)
   */
  navigateSearch: function(direction) {
    if (this.searchMatches.length === 0) return;
    
    // Remove current highlight
    this.clearCurrentMatch();
    
    // Update index
    this.currentMatchIndex += direction;
    if (this.currentMatchIndex < 0) this.currentMatchIndex = this.searchMatches.length - 1;
    if (this.currentMatchIndex >= this.searchMatches.length) this.currentMatchIndex = 0;
    
    // Apply new current highlight
    this.updateCurrentMatch();
    
    // Update info text
    this.updateSearchUI();
  },
  
  /**
   * Clear current match highlighting
   */
  clearCurrentMatch: function() {
    const { originalPreview } = this.getPreviewElements(); // Get fresh reference
    if (!originalPreview) return;
    
    const currentElements = originalPreview.querySelectorAll('.search-match.current');
    currentElements.forEach(el => {
      el.classList.remove('current');
    });
  },
  
  /**
   * Update current match highlighting and scroll into view
   */
  updateCurrentMatch: function() {
    const { originalPreview } = this.getPreviewElements(); // Get fresh reference
    if (!originalPreview || this.currentMatchIndex < 0 || 
        this.currentMatchIndex >= this.searchMatches.length) return;
    
    // Find all search match elements
    const matchElements = originalPreview.querySelectorAll('.search-match');
    
    if (matchElements.length === 0) {
      console.warn('No search match elements found');
      return;
    }
    
    // Use current index directly if within bounds
    let currentElement = null;
    if (this.currentMatchIndex < matchElements.length) {
      currentElement = matchElements[this.currentMatchIndex];
    } else {
      // Fallback: find by data-match-index
      currentElement = Array.from(matchElements).find(
        el => parseInt(el.dataset.matchIndex) === this.currentMatchIndex
      );
    }
    
    if (currentElement) {
      currentElement.classList.add('current');
      
      // Scroll into view with better positioning
      currentElement.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center',
        inline: 'nearest'
      });
      
      console.log(`Scrolled to match ${this.currentMatchIndex + 1} of ${this.searchMatches.length}`);
    } else {
      console.warn(`Could not find match element for index ${this.currentMatchIndex}`);
    }
  },
  
  /**
   * Clear all search highlights
   */
  clearSearchHighlights: function() {
    const { prevMatchBtn, nextMatchBtn, searchResultsInfo } = this.elements;
    const { originalPreview } = this.getPreviewElements(); // Get fresh reference
    if (!originalPreview) return;
    
    // More efficient way to remove highlights
    try {
      // Create a document fragment
      const fragment = document.createDocumentFragment();
      const container = document.createElement('div');
      container.innerHTML = originalPreview.innerHTML;
      
      // Remove highlight spans and replace with their text content
      const highlightSpans = container.querySelectorAll('.search-match');
      highlightSpans.forEach(span => {
        const textNode = document.createTextNode(span.textContent);
        span.parentNode.replaceChild(textNode, span);
      });
      
      // Update the preview
      originalPreview.innerHTML = container.innerHTML;
    } catch (e) {
      // Fallback to simple replacement if error occurs
      let content = originalPreview.innerHTML;
      content = content.replace(/<span class="search-match[^"]*"[^>]*>(.*?)<\/span>/g, '$1');
      originalPreview.innerHTML = content;
    }
    
    // Reset search state
    this.searchMatches = [];
    this.currentMatchIndex = -1;
    
    // Disable navigation buttons
    if (prevMatchBtn) prevMatchBtn.disabled = true;
    if (nextMatchBtn) nextMatchBtn.disabled = true;
    
    // Clear search results info
    if (searchResultsInfo) {
      searchResultsInfo.textContent = '';
    }
  },
  
  /**
   * Escape special characters in a regular expression
   * @param {string} string - String to escape
   * @return {string} Escaped string
   */
  escapeRegExp: function(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
};