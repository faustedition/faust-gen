const puppeteer = require('puppeteer');
const fs = require('fs');
const fsP = fs.promises;
const path = require('path');
const debug = false;

const backend = process.argv[2],
      jobDesc = process.argv[3]

if (process.argv.length !== 4) {
    console.log('Usage: node rendersvgs.js backend job_description', process.argv.length);
} else {

    (async () => {
        try {
            const job = JSON.parse(await fsP.readFile(jobDesc, {encoding: "utf-8"}));
            const args = debug? {args: ['--no-sandbox'], headless: false, slowMo: 100, devtools: true, }: {args: ['--no-sandbox']}
            const browser = await puppeteer.launch(args);
            try {
                const page = await browser.newPage();
                var   logDetail = "";

                page
                    .on('console', message =>
                        console.log(job.sigil, logDetail, `${message.type().substr(0, 3).toUpperCase()} ${message.text()}`))
                    .on('pageerror', ({ message }) => console.error(job.sigil, logDetail, message))
                    .on('requestfailed', request =>
                        console.error(job.sigil, logDetail, `${request.failure().errorText} ${request.url()}`))

                await page.goto(backend, {waitUntil: "domcontentloaded"});
                await page.waitForFunction("function() {return typeof(transcriptGeneration.createPromise) === 'function'}")
                await page.$eval("#preload", el => el.parentNode.removeChild(el));

                await page.screenshot();    // make sure fonts are loaded

                for (const pageDesc of job.transcripts) {
                    logDetail = pageDesc.pageNo;
                    const header = `<div class="onlypdf printheader">
                                        <span class="sigil">${job.sigil}</span>
                                        <img class="logo" src="img/faustlogo.svg">
                                        <span content="pageno">${pageDesc.pageNo}</span></div>`;
                    if (debug)
                        console.log('Rendering', job.sigil, 'page', pageDesc.pageNo)
                    const transcript = await fsP.readFile(pageDesc.json, {encoding: "utf-8"}),
                          imageLinks = pageDesc.links? await fsP.readFile(pageDesc.links, {encoding: "utf-8"}) : null;
                    const result = await page.evaluate((t, i, h) => {
                        return Promise.race([
                            transcriptGeneration.createPromise(t, i, h),
                            new Promise((_, reject) => setTimeout(reject, 30000, 'Rendering took more than 30 seconds'))
                        ]);
                    }, transcript, imageLinks, header);

                    await fsP.mkdir(path.dirname(pageDesc.out), {recursive: true});
                    await fsP.writeFile(pageDesc.out, result.svg, {encoding: "utf-8"});
                    if (pageDesc.links) {
                        await fsP.mkdir(path.dirname(pageDesc.overlayOut), {recursive: true});
                        await fsP.writeFile(pageDesc.overlayOut, result.overlay, {encoding: "utf-8"});
                    }
                }

                await page.evaluate(s => transcriptGeneration.addAboutPage(s), job.sigil);
                const htmlName = job.pdfname.replace(/pdf$/, 'html');
                const html = await page.evaluate(() => { return transcriptGeneration.serialize(document.getRootNode()); });
                await fsP.writeFile(htmlName, html, {encoding: "utf-8"});


                if (!debug) {
                    // console.log("Saving PDF ", job.pdfname, " ...")
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
