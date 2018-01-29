# Transcript Rendering Package

This directory contains code that renders the diplomatic transcript inside the web browser. 

## Usage

Generate the intermediate text markup file, e.g. by calling `SimpleTransform` (see Dependencies) via maven

    mvn --offline -q exec:java -Dexec.mainClass="de.faustedition.transcript.simple.SimpleTransform" < ${XML_INPUT_FILE}
    
The output is a JSON standoff markup format of the XML file. 

Load the `.js`-files in this directory into a web page. Calling `transcriptGeneration.createDiplomaticSvg(standoff_transcript, callback)`
 will generate an SVG rendering of the transcript in the HTML body. `standoff_transcript` is the output from above. 
 `callback` is an optional call back function which will be called with the generated SVG element as single argument.  

If you want to ensure that all web fonts are loaded prior to rendering, you can wrap the rendering call with the included webfont
 loader like so
 
    Faust.Fonts.active (/* render */)

## Dependencies

The rendering library relies on a proprietary text markup format. This can be generated from an XML file by calling
 `de.faustedition.transcript.simple.SimpleTransform.main()` found in `de.faustedition:faust:1.4`

## Directory Contents

### Utilities

`faust.js` General utility functions

`loadwebfonts.js`  Wrap the Google web font loader

`svg-utils.js` SVG utility functions


### Standoff annotation handling 

`adhoc-tree.js` Build a tree from the standoff annotations from `text-annotaion.js`  

`text-annotation.js` Parse standoff markup

`text-index.js` Standoff annotation index for fast lookup

### Layout


`transcript.js` Abstract transcript layout classes

`transcript-adhoc-tree.js` Initialize layout objects from document tree

`transcript-configuration-faust.js` Configure parameters for transcript layout

`transcript-generation.js` Entry point for transcript generation

`transcript-svg.js` Augment the abstract classes in `transcript.js` to do the layout with an SVG 'terminal' 

