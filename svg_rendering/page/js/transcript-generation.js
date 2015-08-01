var transcriptGeneration = (function(){
  "use strict";

  var transcriptGeneration = {};

  var createRenderContainer = (function() {

    var createRenderContainer = function() {
      var renderContainer = document.createElement("div");

      renderContainer.style.height = "0px";
      renderContainer.style.width = "0px";

      renderContainer.style.overflow = "hidden";

      renderContainer.style.position = "fixed";
      renderContainer.style.top = "0px";
      renderContainer.style.left = "0px";

      return renderContainer;
    };

    return createRenderContainer;
  })();

  transcriptGeneration.createDiplomaticSvg = (function() {
    var iterations = 15;
    var timeout = 5;

    var createDiplomaticSvg = function(diplomaticTranscriptString, callback) {
    
      var diplomaticTranscriptJson = JSON.parse(diplomaticTranscriptString);

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

      var computeLayout = function(currentIteration) {
        visComponent.layout();
        if(currentIteration < iterations) {
          // push next layout computation to end of event queue
          setTimeout( function() {
            computeLayout(currentIteration + 1);
          }, timeout);
        } else {
          var rootBBox = innerContainer.getBBox();
          innerContainer.setAttribute("transform", "translate(" + (- rootBBox.x) + "," + (- rootBBox.y) + ")");
          svgRoot.setAttribute("width", rootBBox.width);
          svgRoot.setAttribute("height", rootBBox.height);

          document.body.removeChild(renderContainer);

          callback(renderContainer.firstChild);
        }
      };

      computeLayout(0);
    };

    return createDiplomaticSvg;
  })();

  transcriptGeneration.createFacsimileOverlaySvg = (function(){
    var createFacsimileOverlaySvg = function(diplomaticSvg, textImageLinkSvgString) {

      var renderContainer = createRenderContainer();
      document.body.appendChild(renderContainer);

      // create dom nodes from text-image-link svg string
      var textImageLinkSvg = new DOMParser().parseFromString(textImageLinkSvgString, "image/svg+xml").firstChild;
      textImageLinkSvg.style.position = "absolute";
      textImageLinkSvg.style.top = "0px";
      textImageLinkSvg.style.left = "0px";
      renderContainer.appendChild(textImageLinkSvg);

      Array.prototype.slice.call(textImageLinkSvg.querySelectorAll(".imageannotationLine.imageannotationLinked")).forEach(function(lineNode) {
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

      Array.prototype.slice.call(facsimileOverlaySvg.querySelectorAll(".element-line")).forEach(function(transcriptLine) {
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

      document.body.removeChild(renderContainer);
      facsimileOverlaySvg.style.position = "static";
      facsimileOverlaySvg.style.top = "auto";
      facsimileOverlaySvg.style.left = "auto";
      return facsimileOverlaySvg ;
    };

    return createFacsimileOverlaySvg;
  })();

  return transcriptGeneration;
})();




