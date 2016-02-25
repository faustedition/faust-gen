/*
 * Demo that renders a transcript using phantomjs. Needs to be run with
 * phantomws, obviously.
 */
var page = require('webpage').create(),
    fs = require('fs'),
    system = require('system');

var backend = system.args[1],
    input   = system.args[2],
    output  = system.args[3],
    links   = system.args[4];

if (system.args.length < 4 || system.args.length > 5) {
  console.log('Usage: rendersvgs.js backend input output [links]');
  console.log('  backend: http URL to the transcript-generation.html');
  console.log('  input:   JSON file of the page transcript');
  console.log('  output:  output svg file, will be written');
  console.log('  links:   text image link svg, if given, will write overlay svg');
  phantom.exit(1);
}


page.onError = function (msg, trace) { console.log(msg); trace.forEach(function(item) { console.log(' ', item.file, ':', item.line); }); }; 
page.onConsoleMessage = function(msg, lineNum, sourceId) { console.log('CONSOLE: ' + msg + ' (from line #' + lineNum + ' in "' + sourceId + '")'); };
page.onCallback = function(svgString) {
      out = fs.open(output, { mode: "w", charset: "UTF-8" });
      out.write(svgString);
      out.close();
      phantom.exit();
};

page.open(backend, function(status) {
  var transcript = fs.read(input);

  function renderTranscript(transcript) {
    transcriptGeneration.createDiplomaticSvg(transcript, function(svg) {});
  };

  page.evaluate(renderTranscript, transcript);
});
