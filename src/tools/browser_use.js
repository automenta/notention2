import {z} from 'zod';
import {defineTool} from '../tool_utils.js';

const schema = z.object({
    url: z.string().url(),
    action: z.enum(['open', 'scrape', 'interact']),
    selector: z.string().optional(),
    input: z.string().optional(),
    script: z.string().optional(),
});

async function invoke(input, context) {
    const {url, action, selector} = schema.parse(input);

    context.logToolStart();
    if (action === 'open') {
        const puppeteer = await import('puppeteer');
        const browser = await puppeteer.launch({headless: "new"});
        const page = await browser.newPage();
        await page.goto(url);
        // Optionally return some information or success message
        return `Browser opened to URL: ${url}.`;
    } else if (action === 'scrape') {
        if (!selector) {
            return "Error: Selector is required for scrape action.";
        }
        const puppeteer = await import('puppeteer');
        const browser = await puppeteer.launch({headless: "new"});
        const page = await browser.newPage();
        await page.goto(url);

        try {
            const scrapedData = await page.evaluate((selector) => {
                const elements = Array.from(document.querySelectorAll(selector));
                return elements.map(element => element.textContent.trim());
            }, selector);
            await browser.close();
            return JSON.stringify({
                url: url,
                selector: selector,
                data: scrapedData
            }, null, 2);
        } catch (scrapeError) {
            await browser.close();
            return `Error scraping URL "${url}" with selector "${selector}": ${scrapeError.message}`;
        }
    }

    return `Browser action "${action}" on URL "${url}" is not implemented yet.`;
}

export default defineTool({
    name: 'browser_use',
    description: 'Control a headless browser',
    schema,
    version: '1.0.0',
    dependencies: ['zod', 'puppeteer'],
    invoke: invoke,
});
