const puppeteer = require('puppeteer');
const fs = require('fs');
const fsP = fs.promises;


const backend = process.argv[2],
  input = process.argv[3],
  output = process.argv[4],
  links = process.argv[5],
  linkout = process.argv[6];

if (process.argv.length !== 5 && process.argv.length !== 7) {
  console.log('Usage: node rendersvgs.js backend input output [links linkoutput]');
} else {

    (async () => {
        try {
            const browser = await puppeteer.launch({args: ['--no-sandbox'], /* headless: false, slowMo: 100, devtools: true, */ });
            try {
                const page = await browser.newPage();

                page.on('console', msg => {
                    for (let i = 0; i < msg.args().length; ++i)
                        console.log(`${i}: ${msg.args()[i]}`);
                });

                await page.goto(backend, {waitUntil: "domcontentloaded"});

                const transcript = await fsP.readFile(input, {encoding: "utf-8"}),
                    imagelinks = links ? fsP.readFile(links, {encoding: "utf-8"}) : undefined;

                await page.waitForFunction("function() {return typeof(transcriptGeneration.createPromise) === 'function'}")
                await page.$eval("#preload", el => el.parentNode.removeChild(el));
                const result = await page.evaluate((t, i) => {
                        return Promise.race([
                            transcriptGeneration.createPromise(t, i),
                            new Promise((_, reject) => setTimeout(reject, 30000, 'Rendering took more than 30 seconds'))
                            ]);
                    }, transcript, imagelinks);

                await fsP.writeFile(output, result.svg, {encoding: "utf-8"});
                if (linkout) {
                    await fsP.writeFile(linkout, result.overlay, {encoding: "utf-8"});
                }

                await page.pdf({
                    path: output.replace(/.svg$/, ".pdf"),
                    format: 'A4',
                    margin: ['2cm', '2cm', '2cm', '2cm']
                });
                await page.screenshot({
                    path: output.replace(/.svg$/, ".png"),
                    fullPage: true
                });
            } finally {
                browser.close();
            }
        } catch (e) {
            console.error(e);
        }

    })();
}
