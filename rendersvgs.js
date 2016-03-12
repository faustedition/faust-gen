/*
 * Demo that renders a transcript using phantomjs. Needs to be run with
 * phantomws, obviously.
 */

window.setTimeout(function() {
    console.log("ERROR: Timeout during conversion for " + input);
    phantom.exit(2);
  }, 10000);

var page = require('webpage').create(),
    fs = require('fs'),
    system = require('system');

var backend = system.args[1],
    input   = system.args[2],
    output  = system.args[3],
    links   = system.args[4];
    linkout = system.args[5];

if (system.args.length !== 4 && system.args.length !== 6) {
  console.log('Usage: rendersvgs.js backend input output [links linkoutput]');
  console.log('  backend: http URL to the transcript-generation.html');
  console.log('  input:   JSON file of the page transcript');
  console.log('  output:  output svg file, will be written');
  console.log('  links:   text image link svg, if given, will write overlay svg');
  phantom.exit(1);
}


page.onError = function (msg, trace) { console.log(msg); trace.forEach(function(item) { console.log(' ', item.file, ':', item.line); }); }; 
page.onConsoleMessage = function(msg, lineNum, sourceId) { console.log('CONSOLE: ' + msg + ' (from line #' + lineNum + ' in "' + sourceId + '")'); };
page.onCallback = function(result) {
      out = fs.open(output, { mode: "w", charset: "UTF-8" });
      out.write(result.svg);
      out.close();

      if (linkout) {
        out = fs.open(linkout, { mode: "w", charset: "UTF-8" });
        out.write(result.overlay);
        out.close();
      }

      /* out = fs.open(output + ".html", { mode: "w", charset: "UTF-8" });
      out.write(page.content);
      out.close();
      
      page.evaluate(function() {document.getElementsByTagName('body')[0].style.zoom = 0.62;});
      page.paperSize = "A4";
      page.render(output + ".pdf"); */

      phantom.exit();
};

page.open(backend, function(status) {
  var transcript = fs.read(input, { mode: "r", charset: "UTF-8"}),
      imagelinks = links? fs.read(links, {mode: "r", charset: "UTF-8"}) : undefined;
  
  function render(transcript, imagelinks) {
    transcriptGeneration.createToPhantom(transcript, imagelinks);
  };

  page.evaluate(render, transcript, imagelinks);
  
});
