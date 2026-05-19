// Theme Management
const themeToggleBtn = document.getElementById('themeToggleBtn');
const sunIcon = document.getElementById('sunIcon');
const moonIcon = document.getElementById('moonIcon');

const savedTheme = localStorage.getItem('webscraper-theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);

if (savedTheme === 'light') {
    sunIcon.classList.remove('hidden');
    moonIcon.classList.add('hidden');
}

themeToggleBtn.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('webscraper-theme', newTheme);
    
    if (newTheme === 'light') {
        sunIcon.classList.remove('hidden');
        moonIcon.classList.add('hidden');
    } else {
        sunIcon.classList.add('hidden');
        moonIcon.classList.remove('hidden');
    }
});

const socket = io();

// UI Elements
const launchBtn = document.getElementById('launchBtn');
const closeBtn = document.getElementById('closeBtn');
const targetUrl = document.getElementById('targetUrl');
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');
const selectorPanel = document.getElementById('selectorPanel');
const cssSelector = document.getElementById('cssSelector');
const matchCount = document.getElementById('matchCount');
const sampleText = document.getElementById('sampleText');
const scrapeBtn = document.getElementById('scrapeBtn');
const resultsPanel = document.getElementById('resultsPanel');
const resultsTableBody = document.querySelector('#resultsTable tbody');
const selectionModeGroup = document.getElementById('selectionModeGroup');
const toggleSelectionBtn = document.getElementById('toggleSelectionBtn');

// Export buttons
const downloadJsonBtn = document.getElementById('downloadJsonBtn');
const downloadCsvBtn = document.getElementById('downloadCsvBtn');
const viewHtmlBtn = document.getElementById('viewHtmlBtn');
const htmlModal = document.getElementById('htmlModal');
const modalHtmlContent = document.getElementById('modalHtmlContent');
const closeModal = document.querySelector('.close-modal');

let currentSelector = null;
let scrapedData = [];
let isSelectionModeEnabled = false;

// Socket Events
socket.on('status', (msg) => {
    statusText.textContent = msg;
    if (msg.includes('Ready') || msg.includes('Browser launched')) {
        statusIndicator.classList.add('active');
        launchBtn.classList.add('hidden');
        closeBtn.classList.remove('hidden');
        selectionModeGroup.style.display = 'block';
    } else if (msg.includes('Browser closed')) {
        statusIndicator.classList.remove('active');
        launchBtn.classList.remove('hidden');
        closeBtn.classList.add('hidden');
        selectorPanel.classList.add('hidden');
        selectionModeGroup.style.display = 'none';
        isSelectionModeEnabled = false;
        toggleSelectionBtn.textContent = 'Enable Selection Mode (Currently: OFF)';
        toggleSelectionBtn.classList.remove('primary');
        toggleSelectionBtn.classList.add('outline');
    }
});

socket.on('error', (err) => {
    statusText.textContent = 'Error: ' + err;
    statusText.style.color = 'var(--danger)';
    statusIndicator.classList.remove('active');
});

socket.on('elementSelected', (data) => {
    currentSelector = data.selector;
    cssSelector.textContent = currentSelector;
    matchCount.textContent = `${data.sampleData.count} matches`;
    sampleText.textContent = data.sampleData.text || '(No text content)';
    
    selectorPanel.classList.remove('hidden');
    resultsPanel.classList.add('hidden'); // Hide results when new selection is made
});

socket.on('scrapeComplete', (data) => {
    scrapedData = data;
    renderResults(data);
    resultsPanel.classList.remove('hidden');

    const hasImages = data.some(item => item.img && item.img.startsWith('http'));
    if (hasImages) {
        downloadImgBtn.classList.remove('hidden');
    } else {
        downloadImgBtn.classList.add('hidden');
    }
});

// Interactions
launchBtn.addEventListener('click', () => {
    const url = targetUrl.value;
    if (!url) return alert('Please enter a URL');
    statusText.style.color = 'var(--text-secondary)';
    statusText.textContent = 'Launching browser, please wait...';
    socket.emit('launchBrowser', url);
});

closeBtn.addEventListener('click', () => {
    socket.emit('closeBrowser');
});

toggleSelectionBtn.addEventListener('click', () => {
    isSelectionModeEnabled = !isSelectionModeEnabled;
    socket.emit('toggleSelectionMode', isSelectionModeEnabled);
    
    if (isSelectionModeEnabled) {
        toggleSelectionBtn.textContent = 'Disable Selection Mode (Currently: ON)';
        toggleSelectionBtn.classList.remove('outline');
        toggleSelectionBtn.classList.add('primary');
    } else {
        toggleSelectionBtn.textContent = 'Enable Selection Mode (Currently: OFF)';
        toggleSelectionBtn.classList.remove('primary');
        toggleSelectionBtn.classList.add('outline');
    }
});

scrapeBtn.addEventListener('click', () => {
    if (!currentSelector) return;
    scrapeBtn.textContent = 'Scraping...';
    socket.emit('scrapeAll', currentSelector);
    setTimeout(() => { scrapeBtn.textContent = 'Scrape & Display Data'; }, 1000);
});

// Render Table
function renderResults(data) {
    resultsTableBody.innerHTML = '';
    data.forEach((item, index) => {
        const tr = document.createElement('tr');
        
        const tdIndex = document.createElement('td');
        tdIndex.textContent = index + 1;
        
        const tdText = document.createElement('td');
        tdText.textContent = item.text ? (item.text.substring(0, 100) + (item.text.length > 100 ? '...' : '')) : '(No text)';
        
        const tdLink = document.createElement('td');
        if (item.href) {
            const a = document.createElement('a');
            a.href = item.href;
            a.textContent = 'Link';
            a.target = '_blank';
            tdLink.appendChild(a);
        } else {
            tdLink.textContent = '-';
        }
        
        tr.appendChild(tdIndex);
        tr.appendChild(tdText);
        tr.appendChild(tdLink);
        
        resultsTableBody.appendChild(tr);
    });
}

const downloadImgBtn = document.getElementById('downloadImgBtn');

// Exports
downloadJsonBtn.addEventListener('click', () => {
    if (!scrapedData.length) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(scrapedData, null, 2));
    downloadFile(dataStr, 'scraped_data.json');
});

downloadCsvBtn.addEventListener('click', () => {
    if (!scrapedData.length) return;
    let csvContent = "Index,Text,Link,Image\n";
    
    scrapedData.forEach((item, index) => {
        const text = `"${(item.text || '').replace(/"/g, '""')}"`;
        const link = `"${item.href || ''}"`;
        const img = `"${item.img || ''}"`;
        csvContent += `${index + 1},${text},${link},${img}\n`;
    });
    
    const dataStr = "data:text/csv;charset=utf-8,\uFEFF" + encodeURIComponent(csvContent);
    downloadFile(dataStr, 'scraped_data.csv');
});

downloadImgBtn.addEventListener('click', async () => {
    const imageUrls = scrapedData.filter(item => item.img).map(item => item.img);
    if (!imageUrls.length) return alert('No valid images found to download.');

    downloadImgBtn.textContent = 'Zipping Images...';
    downloadImgBtn.disabled = true;

    try {
        const response = await fetch('/download-images', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ urls: imageUrls })
        });

        if (!response.ok) throw new Error('Failed to zip images');

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'scraped_images.zip';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error(error);
        alert('Error downloading images: ' + error.message);
    } finally {
        downloadImgBtn.textContent = 'Download Images (ZIP)';
        downloadImgBtn.disabled = false;
    }
});

viewHtmlBtn.addEventListener('click', () => {
    if (!scrapedData.length) return;
    const fullHtml = scrapedData.map((item, i) => `<!-- Item ${i+1} -->\n${item.html}`).join('\n\n');
    modalHtmlContent.textContent = fullHtml;
    htmlModal.classList.remove('hidden');
});

closeModal.addEventListener('click', () => {
    htmlModal.classList.add('hidden');
});

window.addEventListener('click', (e) => {
    if (e.target === htmlModal) {
        htmlModal.classList.add('hidden');
    }
});

function downloadFile(dataString, filename) {
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataString);
    downloadAnchorNode.setAttribute("download", filename);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}
