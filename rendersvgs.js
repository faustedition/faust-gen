/*
 * Demo that renders a transcript using phantomjs. Needs to be run with
 * phantomws, obviously.
 */
var page = require('webpage').create(),
    fs = require('fs'),
    system = require('system'),

    transcriptFile = "/home/tv/workspace/faust-gen-all/target/transcript/gsa/391098/0101.xml.json";

page.onError = function (msg, trace) { console.log(msg); trace.forEach(function(item) { console.log(' ', item.file, ':', item.line); }); }; 
page.onConsoleMessage = function(msg, lineNum, sourceId) { console.log('CONSOLE: ' + msg + ' (from line #' + lineNum + ' in "' + sourceId + '")'); };
page.onCallback = function(svgString) {
      out = fs.open("test-callback.svg", { mode: "w", charset: "UTF-8" });
      out.write(svgString);
      out.close();
      phantom.exit();
};

page.open("http://localhost/faust-gen/transcript-generation.html", function(status) {
  var transcript = fs.read(transcriptFile);

  function doRender(transcript) {
    transcriptGeneration.createDiplomaticSvg(transcript, function(svg) {});
  };

  page.evaluate(doRender, transcript);
});
