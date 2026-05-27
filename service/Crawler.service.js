const { chromium } = require("playwright");
const cheerio = require("cheerio");
const crypto = require("crypto");
const PQueue = require("p-queue").default;

class Crawler {
    constructor(options = {}) {
        this.startUrl = options.startUrl;
        this.host = new URL(this.startUrl).host;
        this.maxPages = options.maxPages || 100;
        this.chunkSize = options.chunkSize || 1200;
        this.chunkOverlap = options.chunkOverlap || 200;
        this.visited = new Set();
        this.queue = new PQueue({
            concurrency: options.concurrency || 5
        });

        // FULL WEBSITE TEXT
        this.fullSiteText = "";

        // FINAL CHUNKS
        this.finalChunks = [];

        this.browser = null;
    }

    async init() {
        this.browser = await chromium.launch({
            headless: true
        });
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
        }
    }

    normalizeUrl(url) {
        try {
            const parsed = new URL(url);
            parsed.hash = "";

            return parsed.toString().replace(/\/$/, "");
        } catch {
            return null;
        }
    }

    isValidUrl(url) {
        try {
            const parsed = new URL(url);

            if (parsed.host !== this.host) {
                return false;
            }

            if (
                parsed.pathname.match(
                    /\.(jpg|jpeg|png|gif|svg|pdf|zip|mp4|mp3|ico)$/i
                )
            ) {
                return false;
            }

            return true;
        } catch {
            return false;
        }
    }

    extractText(html) {
        const $ = cheerio.load(html);

        $("script").remove();
        $("style").remove();
        $("noscript").remove();

        return $("body")
            .text()
            .replace(/\s+/g, " ")
            .trim();
    }

    async autoScroll(page) {
        await page.evaluate(async () => {
            await new Promise((resolve) => {
                let totalHeight = 0;

                const distance = 500;

                const timer = setInterval(() => {
                    const scrollHeight =
                        document.body.scrollHeight;

                    window.scrollBy(0, distance);

                    totalHeight += distance;

                    if (totalHeight >= scrollHeight) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 300);
            });
        });
    }

    appendPageContent(url, text) {
        if (!text) return;
        this.fullSiteText += `
        [PAGE_START]
        URL: ${url}

        ${text}

        [PAGE_END]
        `;
    }

    createFinalChunks() {
        const cleanText = this.fullSiteText
            .replace(/\s+/g, " ")
            .trim();

        const chunks = [];

        let start = 0;

        while (start < cleanText.length) {
            const end = start + this.chunkSize;

            const content = cleanText.slice(start, end);

            chunks.push({
                id: crypto.randomUUID(),

                content,

                meta: {
                    host: this.host,
                    chunkIndex: chunks.length,
                    crawledAt: new Date().toISOString()
                }
            });

            start +=
                this.chunkSize - this.chunkOverlap;
        }

        this.finalChunks = chunks;

        return chunks;
    }

    async crawlPage(url) {
        if (this.visited.has(url)) {
            return;
        }

        if (this.visited.size >= this.maxPages) {
            return;
        }

        this.visited.add(url);

        console.log("Crawling:", url);

        const context = await this.browser.newContext();

        const page = await context.newPage();

        try {
            await page.goto(url, {
                waitUntil: "networkidle",
                timeout: 60000
            });

            await this.autoScroll(page);

            const html = await page.content();

            const text = this.extractText(html);

            // SAVE PAGE TEXT
            this.appendPageContent(url, text);

            // GET LINKS
            const links = await page.$$eval(
                "a",
                (elements) =>
                    elements
                        .map((a) => a.href)
                        .filter(Boolean)
            );

            for (const link of links) {
                const normalized =
                    this.normalizeUrl(link);

                if (
                    normalized &&
                    this.isValidUrl(normalized) &&
                    !this.visited.has(normalized)
                ) {
                    this.queue.add(() =>
                        this.crawlPage(normalized)
                    );
                }
            }
        } catch (err) {
            console.error(
                `Failed: ${url}`,
                err.message
            );
        } finally {
            await page.close();

            await context.close();
        }
    }

    async start() {
        await this.init();
        try {
            this.queue.add(() =>
                this.crawlPage(this.startUrl)
            );

            await this.queue.onIdle();
            // CREATE FINAL FULL-SITE CHUNKS
            const chunks = this.createFinalChunks();

            console.log(
                `Crawled ${this.visited.size} pages`
            );

            console.log(
                `Generated ${chunks.length} chunks`
            );

            // RETURN FULL WEBSITE CHUNKS
            return chunks;
        } finally {
            await this.close();
        }
    }
}

module.exports = Crawler;
