const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const archiver = require('archiver');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));
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

io.on('connection', (socket) => {
    console.log('Client connected');

    socket.on('launchBrowser', async (url) => {
        try {
            const puppeteerExtra = (await import('puppeteer-extra')).default;
            const StealthPlugin = (await import('puppeteer-extra-plugin-stealth')).default;
            puppeteerExtra.use(StealthPlugin());

            if (browser) {
                await browser.close();
            }

            browser = await puppeteerExtra.launch({
                headless: false,
                defaultViewport: null,
                ignoreDefaultArgs: ['--enable-automation'],
                args: [
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
            const activePage = pages[pages.length - 1]; // Use latest tab
            if (!activePage) {
                socket.emit('error', 'Browser is not open');
                return;
            }

            socket.emit('status', 'Scraping data...');
            const data = await activePage.evaluate((sel) => {
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

            socket.emit('scrapeComplete', data);
            socket.emit('status', `Successfully scraped ${data.length} items.`);
        } catch (error) {
            console.error(error);
            socket.emit('error', 'Error scraping: ' + error.message);
        }
    });
    
    socket.on('toggleSelectionMode', async (enabled) => {
        try {
            const pages = await browser.pages();
            const activePage = pages[pages.length - 1]; // Use latest tab
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
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
