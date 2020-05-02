const puppeteer = require('puppeteer');
const fs = require('fs');
const fsP = fs.promises;


const backend = process.argv[2],
    input_base = process.argv[3],
    output_base = process.argv[4],
    pages = parseInt(process.argv[5]);

if (process.argv.length !== 6) {
    console.log('Usage: node rendersvgs.js backend input output pages');
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
                await page.waitForFunction("function() {return typeof(transcriptGeneration.createPromise) === 'function'}")
                await page.$eval("#preload", el => el.parentNode.removeChild(el));

                for (let i = 1; i <= pages; i++) {
                    console.log("Rendering page ", i)
                    let input = input_base + i + ".json",
                        output = output_base + i + ".svg";

                    const transcript = await fsP.readFile(input, {encoding: "utf-8"});

                    const result = await page.evaluate((t) => {
                        return Promise.race([
                            transcriptGeneration.createPromise(t),
                            new Promise((_, reject) => setTimeout(reject, 30000, 'Rendering took more than 30 seconds'))
                        ]);
                    }, transcript);

                    await fsP.writeFile(output, result.svg, {encoding: "utf-8"});
                }

                console.log("Saving PDF ...")
                await page.pdf({
                    path: output_base + ".pdf",
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
