const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const archiver = require('archiver');
const { exec } = require('child_process');
const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Initialize Puppeteer stealth plugin
puppeteerExtra.use(StealthPlugin());
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.post('/download-images', async (req, res) => {
    try {
        const { urls } = req.body;
        if (!urls || !Array.isArray(urls) || urls.length === 0) {
            return res.status(400).send('No image URLs provided');
        }

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', 'attachment; filename=scraped_images.zip');

        const archive = archiver('zip', {
            zlib: { level: 9 } // Sets the compression level.
        });

        archive.on('error', (err) => {
            console.error('Archiver error:', err);
            res.status(500).end();
        });

        archive.pipe(res);

        for (let i = 0; i < urls.length; i++) {
            const url = urls[i];
            try {
                // Ensure the URL is valid and absolute
                if (!url || typeof url !== 'string' || !url.startsWith('http')) continue;
                
                const response = await axios({
                    method: 'get',
                    url: url,
                    responseType: 'stream'
                });
                
                // Determine file extension
                let ext = 'jpg';
                if (url.includes('.png')) ext = 'png';
                else if (url.includes('.gif')) ext = 'gif';
                else if (url.includes('.webp')) ext = 'webp';
                else if (url.includes('.svg')) ext = 'svg';
                
                archive.append(response.data, { name: `image_${i + 1}.${ext}` });
            } catch (err) {
                console.error(`Failed to download image ${url}:`, err.message);
                // Continue with other images
            }
        }

        await archive.finalize();
    } catch (error) {
        console.error('Error creating zip:', error);
        if (!res.headersSent) {
            res.status(500).send('Internal Server Error');
        }
    }
});

let browser = null;
let page = null;

// The picker script content
const pickerScript = fs.readFileSync(path.join(__dirname, 'scripts', 'picker.js'), 'utf8');

function findBrowser() {
    const isWindows = process.platform === 'win32';
    const isMac = process.platform === 'darwin';
    const isLinux = process.platform === 'linux';

    const paths = [];
    if (isWindows) {
        // Global Program Files paths
        paths.push(
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
            'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
            'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
            'C:\\Program Files (x86)\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
            'C:\\Program Files\\Chromium\\Application\\chrome.exe',
            'C:\\Program Files\\Opera\\launcher.exe',
            'C:\\Program Files (x86)\\Opera\\launcher.exe',
            'C:\\Program Files\\Vivaldi\\Application\\vivaldi.exe'
        );
        // User Local AppData paths
        if (process.env.LOCALAPPDATA) {
            paths.push(
                path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'),
                path.join(process.env.LOCALAPPDATA, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
                path.join(process.env.LOCALAPPDATA, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
                path.join(process.env.LOCALAPPDATA, 'Chromium', 'Application', 'chrome.exe'),
                path.join(process.env.LOCALAPPDATA, 'Programs', 'Opera', 'launcher.exe'),
                path.join(process.env.LOCALAPPDATA, 'Vivaldi', 'Application', 'vivaldi.exe')
            );
        }
        if (process.env.USERPROFILE) {
            paths.push(
                path.join(process.env.USERPROFILE, 'AppData', 'Local', 'Google', 'Chrome', 'Application', 'chrome.exe'),
                path.join(process.env.USERPROFILE, 'AppData', 'Local', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
                path.join(process.env.USERPROFILE, 'AppData', 'Local', 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
                path.join(process.env.USERPROFILE, 'AppData', 'Local', 'Chromium', 'Application', 'chrome.exe'),
                path.join(process.env.USERPROFILE, 'AppData', 'Local', 'Programs', 'Opera', 'launcher.exe'),
                path.join(process.env.USERPROFILE, 'AppData', 'Local', 'Vivaldi', 'Application', 'vivaldi.exe')
            );
        }
    } else if (isMac) {
        paths.push(
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
            '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
            '/Applications/Chromium.app/Contents/MacOS/Chromium',
            '/Applications/Opera.app/Contents/MacOS/Opera',
            '/Applications/Vivaldi.app/Contents/MacOS/Vivaldi'
        );
    } else if (isLinux) {
        paths.push(
            '/usr/bin/google-chrome',
            '/usr/bin/google-chrome-stable',
            '/usr/bin/chromium-browser',
            '/usr/bin/chromium',
            '/usr/bin/microsoft-edge',
            '/usr/bin/brave-browser',
            '/usr/bin/brave',
            '/usr/bin/opera',
            '/usr/bin/vivaldi',
            '/snap/bin/brave',
            '/snap/bin/chromium',
            '/var/lib/flatpak/exports/bin/com.brave.Browser'
        );
    }

    for (const p of paths) {
        if (fs.existsSync(p)) {
            return p;
        }
    }
    return null; // Fallback to puppeteer's default downloaded browser if in dev mode
}

io.on('connection', (socket) => {
    console.log('Client connected');

    socket.on('launchBrowser', async (url) => {
        try {

            if (browser) {
                await browser.close();
            }

            const browserPath = findBrowser();
            console.log(`[Launch] Target browser detected path: ${browserPath || 'none'}`);
            if (!browserPath && process.pkg) {
                throw new Error("Compatible Chromium-based browser (Google Chrome, Microsoft Edge, Brave, Chromium, Opera, or Vivaldi) not found. Please install one of them to use this tool.");
            }

            browser = await puppeteerExtra.launch({
                headless: false,
                defaultViewport: null,
                executablePath: browserPath || undefined,
                ignoreDefaultArgs: ['--enable-automation'],
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-gpu',
                    '--disable-dev-shm-usage',
                    '--disable-web-security',
                    '--disable-site-isolation-trials',
                    '--start-maximized',
                    '--disable-blink-features=AutomationControlled',
                    '--disable-infobars',
                    '--disable-features=IsolateOrigins,site-per-process'
                ]
            });

            page = (await browser.pages())[0];
            
            // Setup expose function and injection for the initial page
            await page.exposeFunction('onElementSelected', (data) => {
                socket.emit('elementSelected', data);
            }).catch(()=> { /* ignore if already exposed */ });
            
            await page.evaluateOnNewDocument(pickerScript);

            // Also handle any new tabs the user might open
            browser.on('targetcreated', async (target) => {
                if (target.type() === 'page') {
                    const newPage = await target.page();
                    if (newPage) {
                        await newPage.exposeFunction('onElementSelected', (data) => {
                            socket.emit('elementSelected', data);
                        }).catch(()=> {});
                        await newPage.evaluateOnNewDocument(pickerScript);
                    }
                }
            });

            socket.emit('status', 'Browser launched. Navigating to URL...');
            
            await page.goto(url, { waitUntil: 'domcontentloaded' });
            
            socket.emit('status', 'Ready! Please click on an element in the target browser.');
            
            // Close event
            browser.on('disconnected', () => {
                socket.emit('status', 'Browser closed.');
                browser = null;
                page = null;
            });

        } catch (error) {
            console.error(error);
            socket.emit('error', error.message);
        }
    });

    socket.on('scrapeAll', async (selector) => {
        try {
            const pages = await browser.pages();
            // Filter out internal Chrome tabs (like about:blank, chrome://)
            const webPages = pages.filter(p => p.url().startsWith('http'));
            const activePage = webPages[webPages.length - 1] || pages[pages.length - 1] || page;
            if (!activePage) {
                socket.emit('error', 'Browser is not open or no active page found');
                return;
            }

            socket.emit('status', 'Scraping data...');
            let allData = [];
            const frames = activePage.frames();
            console.log(`[Scrape] Querying selector "${selector}" across ${frames.length} frames...`);
            for (let i = 0; i < frames.length; i++) {
                const frame = frames[i];
                try {
                    const url = frame.url();
                    const data = await frame.evaluate((sel) => {
                        const elements = document.querySelectorAll(sel);
                        return Array.from(elements).map(el => {
                            // Try to get text, link, and image if present inside the element
                            const text = el.innerText || el.textContent;
                            const href = el.href || (el.querySelector('a') ? el.querySelector('a').href : null);
                            
                            let img = el.src;
                            
                            // Check for lazy-loaded attributes if it's an img element
                            if (el.tagName.toLowerCase() === 'img') {
                                img = el.getAttribute('data-src') || el.getAttribute('srcset') || el.src;
                            }
                            
                            // If no direct image, search children
                            if (!img && el.querySelector('img')) {
                                const childImg = el.querySelector('img');
                                img = childImg.getAttribute('data-src') || childImg.getAttribute('srcset') || childImg.src;
                            }

                            // Clean up srcset if used (takes the first URL)
                            if (img && img.includes(' ')) {
                                img = img.split(' ')[0];
                            }

                            if (!img) {
                                // Check for background image on the element itself
                                const bgImg = window.getComputedStyle(el).backgroundImage;
                                if (bgImg && bgImg !== 'none') {
                                    const match = bgImg.match(/url\(['"]?(.*?)['"]?\)/);
                                    if (match) img = match[1];
                                }
                            }
                            if (!img && el.querySelector('*')) {
                                // Check children for background image (common in modern frameworks)
                                const withBg = Array.from(el.querySelectorAll('*')).find(child => {
                                    const bg = window.getComputedStyle(child).backgroundImage;
                                    return bg && bg !== 'none';
                                });
                                if (withBg) {
                                    const match = window.getComputedStyle(withBg).backgroundImage.match(/url\(['"]?(.*?)['"]?\)/);
                                    if (match) img = match[1];
                                }
                            }

                            const html = el.innerHTML;
                            return { text: text?.trim(), href, img, html };
                        });
                    }, selector);

                    console.log(`  - Frame ${i} (${url}): found ${data ? data.length : 0} matches`);
                    if (data && data.length > 0) {
                        allData = allData.concat(data);
                    }
                } catch (e) {
                    console.error(`  - Frame ${i} failed to evaluate:`, e.message);
                }
            }

            socket.emit('scrapeComplete', allData);
            socket.emit('status', `Successfully scraped ${allData.length} items.`);
        } catch (error) {
            console.error(error);
            socket.emit('error', 'Error scraping: ' + error.message);
        }
    });
    
    socket.on('toggleSelectionMode', async (enabled) => {
        try {
            const pages = await browser.pages();
            const webPages = pages.filter(p => p.url().startsWith('http'));
            const activePage = webPages[webPages.length - 1] || pages[pages.length - 1] || page;
            if (!activePage) return;

            const frames = activePage.frames();
            for (const frame of frames) {
                await frame.evaluate((en) => {
                    window.__webscraperSelectionMode = en;
                    if (!en) {
                        document.querySelectorAll('.webscraper-highlight, .webscraper-selected').forEach(el => {
                            el.classList.remove('webscraper-highlight', 'webscraper-selected');
                        });
                    }
                }, enabled).catch(() => {});
            }
            socket.emit('status', enabled ? 'Selection Mode ON - Click elements to select' : 'Selection Mode OFF - Browse normally');
        } catch (error) {
            console.error(error);
            socket.emit('error', 'Error toggling mode: ' + error.message);
        }
    });

    socket.on('closeBrowser', async () => {
        if (browser) {
            await browser.close();
            browser = null;
            page = null;
        }
    });
});

const PORT = process.env.PORT || 3000;

server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
        console.error(`\n======================================================`);
        console.error(`ERROR: Port ${PORT} is already in use by another process.`);
        console.error(`Please close any existing instances of ScrapeM3Please.`);
        console.error(`======================================================\n`);
        process.exit(1);
    }
});

server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    
    // Auto-open browser
    const url = `http://localhost:${PORT}`;
    const startCmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
    exec(`${startCmd} ${url}`);
});
