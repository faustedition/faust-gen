/*
 * Copyright (c) 2014 Faust Edition development team.
 *
 * This file is part of the Faust Edition.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

/**
 * @file Entry point for transcript generation
 */

var transcriptGeneration = (function () {
    "use strict";

    /* remove() polyfill */
    if (!('remove' in Element.prototype)) {
        Element.prototype.remove = function () {
            if (this.parentNode) {
                this.parentNode.removeChild(this);
            }
        };
    }

    /* Chrome 48 removed this :(  -> Polyfill */
    SVGElement.prototype.getTransformToElement = SVGElement.prototype.getTransformToElement || function(elem) {
        return elem.getScreenCTM().inverse().multiply(this.getScreenCTM());
    };

    var transcriptGeneration = {};

    var createRenderContainer = (function () {

        var createRenderContainer = function () {
            var renderContainer = document.createElement("div");

//      renderContainer.style.height = "0px";
//      renderContainer.style.width = "0px";

            renderContainer.className = "rendercontainer";

            return renderContainer;
        };

        return createRenderContainer;
    })();


    transcriptGeneration.createDiplomaticSvg = (function () {

        /**
         * Iteratively generates the diplomatic transcript in-browser.
         * @param {string} diplomaticTranscriptString - The transcript text and markup in standoff format
         * @param {function} callback - Function to be called when the layout has finished. Is passed the SVG DOM node
         */


        var createDiplomaticSvg = function (diplomaticTranscriptString, callback, header) {

            var iterations = 15;
            var timeout = 5;

            var diplomaticTranscriptJson = typeof(diplomaticTranscriptString) === "object" ? diplomaticTranscriptString : JSON.parse(diplomaticTranscriptString);
            if (diplomaticTranscriptString === undefined) {
                throw "Argument is undefined!";
            } else if (diplomaticTranscriptJson === undefined) {
                throw "JSON parsing failed!";
            }

            var renderContainer = createRenderContainer();
            document.body.appendChild(renderContainer);

            var documentBuilder = new FaustTranscript.TranscriptAdhocTree();
            var visComponent = documentBuilder.transcriptVC(diplomaticTranscriptJson);

            var svgRoot = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svgRoot.setAttribute("class", "diplomatic");
            renderContainer.appendChild(svgRoot);

            var innerContainer = document.createElementNS("http://www.w3.org/2000/svg", "g");
            innerContainer.setAttribute("id", "transcript_container");
            visComponent.svgCont = innerContainer;
            svgRoot.appendChild(innerContainer);

            visComponent.render();

            var computeLayout = function (currentIteration) {
                visComponent.layout();
                // move content to upper left corner and set witdh and height of container
                function containerAdjustDimensions() {
                    var rootBBox = innerContainer.getBBox();
                    innerContainer.setAttribute("transform", "translate(" + (-rootBBox.x) + "," + (-rootBBox.y) + ")");
                    svgRoot.setAttribute("width", rootBBox.width);
                    svgRoot.setAttribute("height", rootBBox.height);
                }
                if (currentIteration < iterations) {
                    // push next layout computation to end of event queue
                    setTimeout(function () {
                        // console.log('Layout iteration ' + currentIteration);
                        computeLayout(currentIteration + 1);
                        // adjust dimensions and positioning after each step for easier debugging (can be omitted
                        // for production)
                        containerAdjustDimensions();
                    }, timeout);
                } else {
                    containerAdjustDimensions();
                    if (typeof callback !== 'undefined') {
                        const svg = renderContainer.firstChild;
                        if (header) {
                            const headerDiv = document.createElement('div');
                            renderContainer.insertBefore(headerDiv, svg)
                            headerDiv.outerHTML = header;
                        }
                        callback(svg);
                    }
                }
            };

            computeLayout(0);
        };

        return createDiplomaticSvg;
    })();

    transcriptGeneration.createFacsimileOverlaySvg = (function () {
        var createFacsimileOverlaySvg = function (diplomaticSvg, textImageLinkSvgString) {

            var renderContainer = createRenderContainer();
            document.body.appendChild(renderContainer);

            // create dom nodes from text-image-link svg string
            var textImageLinkSvg = new DOMParser().parseFromString(textImageLinkSvgString, "image/svg+xml").firstChild;
            textImageLinkSvg.style.position = "absolute";
            textImageLinkSvg.style.top = "0px";
            textImageLinkSvg.style.left = "0px";
            renderContainer.appendChild(textImageLinkSvg);

            Array.prototype.slice.call(textImageLinkSvg.querySelectorAll(".imageannotationLine.imageannotationLinked")).forEach(function (lineNode) {
                var heightFactor = 2;
                var height = lineNode.getAttribute('height');
                lineNode.setAttribute('height', height * heightFactor);
                var y = lineNode.getAttribute('y');
                lineNode.setAttribute('y', y - ((heightFactor * height) - height));

                var linkedLine = lineNode.getAttributeNS("http://www.w3.org/1999/xlink", 'href');
                var classVal = "linkedto-" + linkedLine.substring(1);
                lineNode.setAttribute('class', lineNode.getAttribute('class') + ' ' + classVal);
            });

            var facsimileOverlaySvg = diplomaticSvg.cloneNode(true);
            facsimileOverlaySvg.style.position = "absolute";
            facsimileOverlaySvg.style.top = "0px";
            facsimileOverlaySvg.style.left = "0px";
            renderContainer.appendChild(facsimileOverlaySvg);

            facsimileOverlaySvg.setAttribute("width", textImageLinkSvg.getAttribute("width"));
            facsimileOverlaySvg.setAttribute("height", textImageLinkSvg.getAttribute("height"));

            Array.prototype.slice.call(facsimileOverlaySvg.querySelectorAll(".element-line")).forEach(function (transcriptLine) {
                var xmlId = SvgUtils.decodeClassValue(transcriptLine.getAttribute('class'), 'xmlId-');
                var imageLinkLine = textImageLinkSvg.querySelector(".imageannotationLine.linkedto-" + xmlId);

                if (imageLinkLine) {
                    SvgUtils.fitTo(transcriptLine, imageLinkLine);
                } else {
                    transcriptLine.remove(true);
                }

            });

            facsimileOverlaySvg.setAttribute("viewBox", "0 0 " + textImageLinkSvg.getAttribute("width") + " " + textImageLinkSvg.getAttribute("height"));
            facsimileOverlaySvg.setAttribute("preserveAspectRatio", "xMinYMin meet");

//      document.body.removeChild(renderContainer);
            facsimileOverlaySvg.style.position = "static";
            facsimileOverlaySvg.style.top = "auto";
            facsimileOverlaySvg.style.left = "auto";
            return facsimileOverlaySvg;
        };

        return createFacsimileOverlaySvg;
    })();


    function serialize(node) {
        var serializer = new XMLSerializer(),
            serializedSvg = serializer.serializeToString(node).replace(/&nbsp;/g, '&#160;');
        return serializedSvg;
    };


    transcriptGeneration.createToPhantom = function createToPhantom(transcript, links) {
        transcriptGeneration.createDiplomaticSvg(transcript, function (diploSvg) {
            var result = {svg: serialize(diploSvg), overlay: undefined};
            if (links) {
                var overlaySvg = transcriptGeneration.createFacsimileOverlaySvg(diploSvg, links);
                result.overlay = serialize(overlaySvg);
                overlaySvg.parentNode.removeChild(overlaySvg);
            }
            try {
                window.callPhantom(result);
            } catch (e) {
                console.log("Phantom callback failed: ", e);
            }
        });
    }
    
    transcriptGeneration.createPromise = function createPromise(transcript, links, header) {
        return new Promise((resolve, reject) => {
            transcriptGeneration.createDiplomaticSvg(transcript, (diploSvg) => {
                const result = {svg: serialize(diploSvg), overlay: undefined};
                if (links) {
                    const overlaySvg = transcriptGeneration.createFacsimileOverlaySvg(diploSvg, links);
                    result.overlay = serialize(overlaySvg);
                    const renderContainer = overlaySvg.parentElement;
                    renderContainer.parentNode.removeChild(renderContainer);
                }
                resolve(result);
            }, header);
        });
    }

    return transcriptGeneration;
})();




