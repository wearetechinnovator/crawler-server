const { chromium } = require("playwright");
const cheerio = require("cheerio");
const crypto = require("crypto");
const PQueue = require("p-queue").default;
const { getIO } = require("../socket/socket");

class Crawler {
    constructor(options = {}) {
        this.req = options.req;
        this.res = options.res;
        this.propertyId = options.propertyId;

        this.startUrl = options.startUrl;
        this.host = new URL(this.startUrl).host;

        this.maxPages = options.maxPages || 100;

        this.chunkSize = options.chunkSize || 1200;
        this.chunkOverlap = options.chunkOverlap || 200;

        this.visited = new Set();

        this.queue = new PQueue({
            concurrency: options.concurrency || 2
        });

        this.finalChunks = [];

        this.browser = null;
        this.context = null;
    }

    async init() {
        this.browser = await chromium.launch({
            headless: true
        });

        this.context =
            await this.browser.newContext();
    }

    async close() {
        if (this.context) {
            await this.context.close();
        }

        if (this.browser) {
            await this.browser.close();
        }
    }

    normalizeUrl(url) {
        try {
            const parsed = new URL(url);
            parsed.hash = "";
            return parsed
                .toString()
                .replace(/\/$/, "");
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
                    /\.(jpg|jpeg|png|gif|svg|pdf|zip|mp4|mp3|ico|webp)$/i
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
        try {
            await page.evaluate(() => {
                window.scrollTo(
                    0,
                    document.body.scrollHeight
                );
            });

            await page.waitForTimeout(1000);
        } catch {
            //
        }
    }

    chunkText(text, url) {
        const cleanText = text
            .replace(/\s+/g, " ")
            .trim();

        const chunks = [];

        let start = 0;

        while (start < cleanText.length) {
            const end =
                start + this.chunkSize;

            const content =
                cleanText.slice(
                    start,
                    end
                );

            chunks.push({
                id: crypto.randomUUID(),

                content,

                meta: {
                    url,
                    host: this.host,
                    chunkIndex:
                        chunks.length,
                    crawledAt:
                        new Date().toISOString()
                }
            });

            start +=
                this.chunkSize -
                this.chunkOverlap;
        }

        return chunks;
    }

    sendProgress(propertyId, url) {
        try {
            const io = getIO();

            io.to(
                `crawl:${propertyId}`
            ).emit(
                "page_crawling",
                {
                    url
                }
            );
        } catch (err) {
            console.error(
                "Socket Error:",
                err.message
            );
        }
    }

    async crawlPage(url) {
        if (
            this.visited.has(url)
        ) {
            return;
        }

        if (
            this.visited.size >=
            this.maxPages
        ) {
            return;
        }

        this.visited.add(url);

        this.sendProgress(
            this.propertyId,
            url
        );

        const page =
            await this.context.newPage();

        try {
            await page.goto(url, {
                waitUntil:
                    "domcontentloaded",
                timeout: 30000
            });

            await this.autoScroll(
                page
            );

            const html =
                await page.content();

            const text =
                this.extractText(
                    html
                );

            if (text) {
                const pageChunks =
                    this.chunkText(
                        text,
                        url
                    );

                this.finalChunks.push(
                    ...pageChunks
                );
            }

            const links =
                await page.$$eval(
                    "a",
                    (elements) =>
                        elements
                            .map(
                                (a) =>
                                    a.href
                            )
                            .filter(
                                Boolean
                            )
                );

            for (const link of links) {
                const normalized =
                    this.normalizeUrl(
                        link
                    );

                if (
                    normalized &&
                    this.isValidUrl(
                        normalized
                    ) &&
                    !this.visited.has(
                        normalized
                    )
                ) {
                    this.queue.add(
                        () =>
                            this.crawlPage(
                                normalized
                            )
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
        }
    }

    async start() {
        await this.init();

        try {
            this.queue.add(() =>
                this.crawlPage(
                    this.startUrl
                )
            );

            await this.queue.onIdle();

            console.log(
                `Crawled ${this.visited.size} pages`
            );

            console.log(
                `Generated ${this.finalChunks.length} chunks`
            );

            return {
                chunks:
                    this.finalChunks,
                count:
                    this.visited.size
            };
        } finally {
            await this.close();
        }
    }
}

module.exports = Crawler;