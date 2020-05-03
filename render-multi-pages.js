const puppeteer = require('puppeteer');
const fs = require('fs');
const fsP = fs.promises;
const debug = false;

const backend = process.argv[2],
      jobDesc = process.argv[3]

if (process.argv.length !== 4) {
    console.log('Usage: node rendersvgs.js backend job_description', process.argv.length);
} else {

    (async () => {
        try {
            const job = JSON.parse(await fsP.readFile(jobDesc), {encoding: "utf-8"});
            const args = debug? {args: ['--no-sandbox'], headless: false, slowMo: 100, devtools: true, }: {args: ['--no-sandbox']}
            const browser = await puppeteer.launch(args);
            try {
                const page = await browser.newPage();

                page
                    .on('console', message =>
                        console.log(`${message.type().substr(0, 3).toUpperCase()} ${message.text()}`))
                    .on('pageerror', ({ message }) => console.error(message))
                    .on('requestfailed', request =>
                        console.log(`${request.failure().errorText} ${request.url()}`))

                await page.goto(backend, {waitUntil: "domcontentloaded"});
                await page.waitForFunction("function() {return typeof(transcriptGeneration.createPromise) === 'function'}")
                await page.$eval("#preload", el => el.parentNode.removeChild(el));

                await page.screenshot();    // make sure fonts are loaded

                for (const pageDesc of job.transcripts) {
                    console.log('Rendering', job.sigil, 'page', pageDesc.pageNo)
                    const transcript = await fsP.readFile(pageDesc.json, {encoding: "utf-8"}),
                          imageLinks = pageDesc.links? await fsP.readFile(pageDesc.links, {encoding: "utf-8"}) : null;
                    const result = await page.evaluate((t, i) => {
                        return Promise.race([
                            transcriptGeneration.createPromise(t, i),
                            new Promise((_, reject) => setTimeout(reject, 30000, 'Rendering took more than 30 seconds'))
                        ]);
                    }, transcript, imageLinks);

                    await fsP.writeFile(pageDesc.out, result.svg, {encoding: "utf-8"});
                    if (pageDesc.links) {
                        await fsP.writeFile(pageDesc.overlayOut, result.overlay, {encoding: "utf-8"});
                    }
                }

                if (!debug) {
                    console.log("Saving PDF ", job.pdfname, " ...")
                    await page.pdf({
                        path: job.pdfname,
                        format: 'A4',
                        margin: ['2cm', '2cm', '2cm', '2cm']
                    });
                } else {
                    console.log('Debug mode -> No PDF')
                    page.emulateMediaType("print");
                }
            } finally {
                if (!debug) browser.close();
            }
        } catch (e) {
            console.error(e);
        }

    })();
}
