# ScrapeM3Please

A "no-code" point-and-click web scraping tool built with Node.js, Express, and Puppeteer Stealth. 

This tool allows you to extract data (text, links, images, and HTML) from almost any public website without writing a single line of CSS selector code. It features a dual-browser architecture that launches a stealth-enabled Chromium instance to bypass many common bot protections, letting you interact with the page normally before activating selection mode to scrape.

## Features
- **Point & Click Selection**: No coding required. Just click the element you want to scrape, and the tool automatically computes the optimal CSS selector.
- **Stealth Mode**: Powered by `puppeteer-extra-plugin-stealth` to evade aggressive bot detection.
- **Live Preview**: See what data you are capturing in real-time on your dashboard.
- **Multiple Exports**: Download your scraped data instantly as JSON, CSV, or view the raw HTML.
- **Bulk Image Downloader**: Automatically detects lazy-loaded images or background images and allows you to download them all in a single `.zip` file!
- **Dynamic Content Support**: Handles modern single-page applications, infinite scrolling, and iframes gracefully.

---

## Installation & Setup

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- npm (comes with Node.js)

### Installation Steps

1. **Clone or Download the Repository:**
   ```bash
   git clone https://github.com/N3k0sint/ScrapeM3Please
   cd WebScrapper
   ```

2. **Install Dependencies:**
   Run the following command to install the required packages (`express`, `puppeteer`, `puppeteer-extra`, `socket.io`, etc.):
   ```bash
   npm install
   ```

3. **Start the Server:**
   ```bash
   node server.js
   ```

4. **Open the Dashboard:**
   Open your main web browser (Chrome, Edge, Safari) and navigate to:
   ```
   http://localhost:3000
   ```

### Building Standalone Executables
If you want to package this tool into a standalone executable file (`.exe` for Windows, or binary files for Linux and Mac) so you can share it with friends who do not have Node.js installed:

1. **Install `pkg` globally:**
   ```bash
   npm install -g pkg
   ```
2. **Compile the project:**
   Run the compilation command for your platform (or run all three to distribute!):
   
   - **For Windows (.exe):**
     ```bash
     npx pkg . -t node18-win-x64 -o build/ScrapeM3Please.exe
     ```
   - **For Linux:**
     ```bash
     npx pkg . -t node18-linux-x64 -o build/ScrapeM3Please-Linux
     ```
   - **For macOS:**
     ```bash
     npx pkg . -t node18-macos-x64 -o build/ScrapeM3Please-MacOS
     ```
   This will generate the standalone files inside the `build/` directory.

---

## How to Use the Scraper

1. **Launch the Target Browser:**
   - Enter the URL of the website you want to scrape into the input field on the dashboard.
   - Click **Launch Target Browser**.
   - A new, automated Chromium window will open and navigate to your URL.

2. **Navigate Normally:**
   - By default, **Selection Mode is OFF**. 
   - This means you can interact with the target website normally. You can log in, solve captchas, scroll down to load more items, or click buttons (e.g., "See all 243 reviews") to open modals.

3. **Activate Selection Mode:**
   - Once the data you want to scrape is fully visible on the screen, go back to your dashboard (localhost:3000).
   - Click **Enable Selection Mode**.

4. **Point and Click:**
   - Return to the automated Chromium window. 
   - As you move your mouse, elements will highlight with a pink border.
   - Click on the text/item you want to extract. It will highlight in green, and all matching items on the page will also highlight in green.
   - *Tip: If it selects too much (like the navigation bar), try clicking a more specific part of the item, like the title or date!*

5. **Scrape and Export:**
   - Check your dashboard to see a preview of the selected data.
   - Click **Scrape & Display Data**.
   - Review your data in the table, and click **Download CSV** or **Download JSON** to save it!

---

## Troubleshooting & Pro-Tips

### Opening CSV Files in Excel (Foreign Characters)
*(Update: This tool now automatically injects a UTF-8 BOM marker into exports, meaning you can simply double-click the CSV and Excel will read foreign characters and multi-line paragraphs perfectly!)*

### "Hash" Symbols in Excel (########)
If you see `########` in an Excel column (usually for dates), it simply means the column is too narrow to display the text. **Double-click the line between the column headers** (e.g., between A and B) to automatically resize the column and reveal the data.

### Selecting the Wrong Data
Web scraping requires a bit of trial and error! If you try to scrape reviews but accidentally scrape the website's navigation menu as well, it means you clicked on a very "generic" element (like a plain `<div>`). 
**The Fix:** Try to find a more unique element inside the review box to click on, such as the timestamp, the star rating, or the author's username.

### Standalone Executables: Linux Permission Denied
If you are running the standalone Linux binary and get a "Permission Denied" error, it is because Git does not preserve the executable bit by default.
**The Fix:** Open a terminal and grant execute permissions to the binary before running it:
```bash
chmod +x build/ScrapeM3Please-Linux
./build/ScrapeM3Please-Linux
```

### Stuck on "Ready to start" / Port 3000 Conflicts
If the dashboard opens but clicking **Launch Target Browser** does not respond or stays stuck on "Ready to start":
1. Check your terminal output. If you see an `EADDRINUSE` error, another instance of `ScrapeM3Please` is already running in the background and occupying Port 3000.
2. **The Fix:** Close all terminal windows and open your Task Manager (Windows) or System Monitor (Linux/Mac) and terminate any lingering `ScrapeM3Please` or `Node.js` processes. Then, run the executable again.

## Tech Stack
- **Backend:** Node.js, Express, Socket.io
- **Scraping Engine:** Puppeteer, Puppeteer-Extra (Stealth Plugin)
- **Frontend:** Vanilla HTML/CSS/JS with a professional SaaS-style Dark/Light theme UI

---

## Legal Disclaimer & Ethical Policy

> [!CAUTION]
> **For Educational and Research Purposes Only**
> This tool ("ScrapeM3Please") was created strictly for educational purposes, security research, and personal learning. The authors and contributors are not responsible for any misuse, damage, or legal consequences caused by the use of this software. 

### Ethical Scraping Guidelines
When using this tool, you agree to adhere to the following ethical guidelines:
1. **Respect Terms of Service:** Do not scrape websites that explicitly forbid automated data extraction in their Terms of Service (ToS).
2. **Respect `robots.txt`:** Always check and honor a website's `robots.txt` file before scraping.
3. **Avoid Disruption:** Do not use this tool to perform Denial of Service (DoS) attacks or send an overwhelming amount of requests that could degrade a website's performance.
4. **Data Privacy:** Do not scrape, store, or distribute personally identifiable information (PII) or sensitive user data without explicit consent.

By downloading and running this software, you assume full responsibility for your actions and compliance with local and international laws regarding data scraping and copyright.

---

## License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details. You are free to use, modify, and distribute this software for educational and personal projects.
