## Faust data generation

The Faust-Edition web application builds on data that is automatically pre-generated from the original XML files. This project integrates the various generation and upload processes (except for the images, actually).

## Note: Maven → Gradle transition

The project is currently switching its build system from Maven to Gradle. Currently, everything except for the final deploy-via-rsync phase works using Gradle, and building by Gradle is the recommended way:

```bash
git clone --recursive https://github.com/faustedition/faust-gen
cd faust-gen
./gradlew build
```

This will clone this repository and all of its subrepositories, download (almost¹) everything that is needed to build and runs the build. As a result, you can find:

* the complete site except for the facsimiles and the search app in `build/www`
* the search app ready to be deployed into eXist in `build/faust-*.xar`

and a lot of auxilliary and intermediate files in `build`.

For the build to run, you need to have _Java_ and _GraphViz_ installed locally. 


## Basic Usage

Clone the project and all submodules and run `mvn clean package` (or just `mvn`)

## Dependencies

Maven ≥ 3.2 and Java ≥ 8 are required. 

For the `deploy` step, you need a local rsync and make sure we can build a ssh connection to the target server (e.g., by providing an SSH agent with an unlocked key).

## eXist-based search

There is a preliminary eXist app that implements the search functionality. Deploying the app to the eXist server automatically from the build is not yet implemented, however, there are two preliminary ways to get the data in there:

* `mvn package` builds an eXist application archive, `faust.xar`, that can then be deployed to the database using, e.g., its package manager
* You can run a command line along the lines of `mvn -P'exist' -Dexist.uri=xmldb:exist://localhost:8080/exist/xmlrpc/db/apps/faust antrun:run -Dexist.user=admin -Dexist.pass=secret` to update all the files (data and code) of an already-deployed app after you have built at least the 'xproc' stuff.

## Advanced usage

!! Parts of this section are slightly outdated …

The build uses _profiles_ to select the parts that should run. The profile `svg` (`mvn -Psvg package`) runs the SVG generation, the profile `xproc` the XProc stuff. Everything is on by default, so just running `mvn clean package` will generate the whole site (except images) in `target/www`

## Components

### Diplomatic transcripts: SVG generation

The diplomatic transcripts are rendered page by page using JavaScript in a simulated browser. 

The code that does the actual rendering can be found in <svg_rendering/page>. This folder contains a simple web page, with font resources etc. pulled in from faust-web, plus the rendering code mainly developed by Moritz Wissenbach in <svg_rendering/page/js_gen>. 

To create both the diplomatic transcript and the overlay transcript for a single page, <render-multi-pages.js> is called using node.js. This uses [Puppeteer](https://pptr.dev/) to remote-control a headless Chromium browser in which each page will be rendered as SVG. The SVGs will then be extracted and stored so they can later be included in the edition’s UI.

The JS does not directly work with the XML transcripts. Instead, each page needs to be transformed to a JSON representation, which is done using code from https://github.com/faustedition/faust-app, which is pulled in as a Maven dependency. The Java program at <src/main/java/net/faustedition/gen/DiplomaticConversion.java> is used to run the actual pipeline, i.e. iterate through the manuscripts and their pages, convert stuff to JSON, and run <rendersvgs.js> on each of these JSON files. Intermediate results (i.e. JSON files) and, if enabled, debugging data (e.g., PDFs) are written to the target directory.

The process might well take 1.5h, it is bound to the `svg` profile. All components — nodejs, puppeteer as well as Chromium – will be downloaded on first run.

### Textual transcripts, metadata, and overview data

Basically all other data that depends on the source data is generated using the https://github.com/faustedition/faust-gen-html project, which is cloned as a submodule to `src/main/xproc`. This includes:

* an emended XML version of all textual transcripts as TEI
* a reading version, and a line-wise apparatus out of this version
* an inline apparatus _(Einblendungsapparat)_ for all textual transcripts as HTML
* an HTML version of the metadata, and the project's bibliography
* the JSON basis for the genesis bar graph
* various other JSON data used by the web application

This process takes around 1/2h, it is bound to the xproc profile. You can run individual parts from within that project, look at its documentation. Intermediate and generated files are put in the `target` directory.

### Web application, and putting it all together

The web application, i.e. all non-generated code, is pulled in from http://github.com/faustedition/faust-web as submodule `src/main/web`. 

<pom.xml> contains code to actually run this all, and copy stuff around. Afterwards, the complete web site (except for the digitized manuscripts) can be found at `target/www`. If you run the `deploy` phase, it is rsynced to the server.

## Semiautomatical stuff

There are two steps that involve pulling in data from the internal wiki:

* The table of testimonies, generated using <get_testimonies.py> and saved to `src/main/web/archive_testimonies.php`
* The input file for the bibliography, see faust-gen-html

## Not integrated yet

* filling the eXist instance, see the scripts in faust-gen-html
* preparing the facsimiles, see convert.sh 
* running the macrogenesis part
