# Transcript Rendering Package

This directory contains code that renders the diplomatic transcript inside the web browser. 

## Usage

Generate the intermediate text markup file, e.g. by calling `SimpleTransform` (see Dependencies) via maven

    mvn --offline -q exec:java -Dexec.mainClass="de.faustedition.transcript.simple.SimpleTransform" < ${INPUT_FILE}

## Dependencies

The rendering library relies on a proprietary text markup format. This can be generated from an XML file by calling
 `de.faustedition.transcript.simple.SimpleTransform.main()` found in `de.faustedition:faust:1.4`

## Directory Contents

