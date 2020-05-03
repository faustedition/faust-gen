const puppeteer = require('puppeteer');
const fs = require('fs');
const fsP = fs.promises;


const backend = process.argv[2],
      jobDesc = process.argv[3]

if (process.argv.length !== 4) {
    console.log('Usage: node rendersvgs.js backend job_description', process.argv.length);
} else {

    (async () => {
        try {
            const job = JSON.parse(await fsP.readFile(jobDesc), {encoding: "utf-8"});
            const browser = await puppeteer.launch({args: ['--no-sandbox'], /* headless: false, slowMo: 100, devtools: true, */ });
            try {
                const page = await browser.newPage();

                page.on('console', msg => {
                    for (let i = 0; i < msg.args().length; ++i)
                        console.log(`${i}: ${msg.args()[i]}`);
                });

                await page.goto(backend, {waitUntil: "domcontentloaded"});
                await page.waitForFunction("function() {return typeof(transcriptGeneration.createPromise) === 'function'}")
                await page.$eval("#preload", el => el.parentNode.removeChild(el));

                await page.screenshot();    // make sure fonts are loaded

                for (const pageDesc of job.transcripts) {
                    console.log('Rendering', job.sigil, 'page', pageDesc.pageNo)
                    const transcript = await fsP.readFile(pageDesc.json, {encoding: "utf-8"});
                    const result = await page.evaluate((t) => {
                        return Promise.race([
                            transcriptGeneration.createPromise(t),
                            new Promise((_, reject) => setTimeout(reject, 30000, 'Rendering took more than 30 seconds'))
                        ]);
                    }, transcript);

                    await fsP.writeFile(pageDesc.out, result.svg, {encoding: "utf-8"});
                }

                console.log("Saving PDF ", job.pdfname, " ...")
                await page.pdf({
                    path: job.pdfname,
                    format: 'A4',
                    margin: ['2cm', '2cm', '2cm', '2cm']
                });
            } finally {
                browser.close();
            }
        } catch (e) {
            console.error(e);
        }

    })();
}
