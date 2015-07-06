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

if(window.SvgUtils === undefined) {
  window.SvgUtils = {};
}

(function(SvgUtils){


	var SVG_NS = "http://www.w3.org/2000/svg";

	function decodeClassValue(classValue, key) {
		var start = classValue.indexOf(key);
		if (start < 0) {
      return '';
    }
		var rightSide = classValue.substring(start + key.length);
		var end = rightSide.search('\\s');
		return end >= 0 ? rightSide.substring(0, end) : rightSide;
	}


	function qscale (degree) {
		return function (val) {
			return val * Math.pow(2, degree);
		};
	}

	function svgElement(name) {
		return document.createElementNS(SVG_NS, name);
	}

	function svgAttrs(element, attrs) {
    Object.keys(attrs).forEach(function(attr) {
      element.setAttribute(attr, attrs[attr]);
    });
		return element;
	}

	function hasClass(yuiNode, classValue) {
		var classTokens = yuiNode.getDOMNode().getAttribute('class').split(' ');
		return classTokens.indexOf(classValue) >= 0;
	}

	function addClass(yuiNode, newClass) {
		var domNode = yuiNode.getDOMNode();
		var classValue = domNode.getAttribute('class');
		domNode.setAttribute('class', classValue + ' ' + newClass);
	}

	function removeClass(yuiNode, removeValue) {
		var domNode = yuiNode.getDOMNode();
		var classTokens = domNode.getAttribute('class').split(' ');
		var newClassValue = '';
		for (var i = 0; i < classTokens.length; i++) {
			if (classTokens[i] !== removeValue) {
				newClassValue = newClassValue + classTokens[i] + ' ';
			}
		}
		domNode.setAttribute('class', newClassValue);
	}

	function svgStyles(element, styles) {
    Object.keys(styles).forEach(function(style) {
      element.style[style] = styles[style];
    });
		return element;
	}

	function svg(element, attrs, styles) {
		return svgStyles(svgAttrs(
			svgElement(element), attrs || {}), styles || {});
	}

	function empty(element) {
		while (element.firstChild) {
			element.removeChild(element.firstChild);
		}
	}
	
	// An implementation of getScreenBBox, by Antoine Quint, modiefied by Moritz Wissenbach
	// http://the.fuchsia-design.com/2006/12/getting-svg-elementss-full-bounding-box.html
	function getScreenBBox(element, svgRoot) {

		// macro to create an SVGPoint object
		function createPoint (x, y) {
			var point = svgRoot.createSVGPoint();
			point.x = x;
			point.y = y;
			return point;
		}

		// macro to create an SVGRect object
		function createRect (x, y, width, height) {
			var rect = svgRoot.createSVGRect();
			rect.x = x;
			rect.y = y;
			rect.width = width;
			rect.height = height;
			return rect; 
		}

		// get the complete transformation matrix
		//var matrix = element.getTransformToElement(svgRoot);
		var matrix = svgRoot.getTransformToElement(element);
		// get the bounding box of the target element
		var box = element.getBBox();

		// create an array of SVGPoints for each corner
		// of the bounding box and update their location
		// with the transform matrix
		var corners = [];
		var point = createPoint(box.x, box.y);
		corners.push( point.matrixTransform(matrix) );
		point.x = box.x + box.width;
		point.y = box.y;
		corners.push( point.matrixTransform(matrix) );
		point.x = box.x + box.width;
		point.y = box.y + box.height;
		corners.push( point.matrixTransform(matrix) );
		point.x = box.x;
		point.y = box.y + box.height;
		corners.push( point.matrixTransform(matrix) );
		var max = createPoint(corners[0].x, corners[0].y);
		var min = createPoint(corners[0].x, corners[0].y);

		// identify the new corner coordinates of the
		// fully transformed bounding box
		for (var i = 1; i < corners.length; i++) {
			var x = corners[i].x;
			var y = corners[i].y;
			if (x < min.x) {
				min.x = x;
			}
			else if (x > max.x) {
				max.x = x;
			}
			if (y < min.y) {
				min.y = y;
			}
			else if (y > max.y) {
				max.y = y;
			}
		}
		
		// return the bounding box as an SVGRect object
		return createRect(min.x, min.y, max.x - min.x, max.y - min.y);
	}


	/**
	 * Safely get and return the bounding box of element as seen from its local coordinate system.
	 */

	function localBoundingBox(element) {

		// Firefox will throw an exception when calling getBBox() on an element with display: none
		// see https://bugzilla.mozilla.org/show_bug.cgi?id=612118

    var visible = true;
    var el = element;
    if(window.getComputedStyle(el).display === 'none') {
      visible = false;
    }
    while((el = el.parentNode)) {
      if((el.nodeType === 1) && (window.getComputedStyle(el).display === 'none')) {
          visible = false;
        }
    }

		// local bounding box in local coordinates
		if (visible) {
			return element.getBBox();
		} else {
			return {x:0, y:0, width:0, height:0};
		}
	}

	/**
	 * Return the bounding box of element as seen from the coordinate system given by matrix. If matrix is not
	 * given, the local coordinate system of element is assumed.
	 */

	function boundingBox(element, matrix) {

		// macro to create an SVGPoint object
		function createPoint (x, y) {
			var point = element.viewportElement.createSVGPoint();
			point.x = x;
			point.y = y;
			return point;
		}

		// macro to create an SVGRect object
		function createRect (x, y, width, height) {
			var rect = element.viewportElement.createSVGRect();
			rect.x = x;
			rect.y = y;
			rect.width = width;
			rect.height = height;
			return rect;
		}

		var box = localBoundingBox(element);

		if (typeof matrix === 'undefined') {
			return box;
		}

		var inv = matrix.inverse();

		inv = inv.multiply(element.getCTM());

		// create an array of SVGPoints for each corner
		// of the bounding box and update their location
		// with the transform matrix
		var corners = [];
		var point = createPoint(box.x, box.y);
		corners.push(point.matrixTransform(inv) );
		point.x = box.x + box.width;
		point.y = box.y;
		corners.push( point.matrixTransform(inv) );
		point.x = box.x + box.width;
		point.y = box.y + box.height;
		corners.push( point.matrixTransform(inv) );
		point.x = box.x;
		point.y = box.y + box.height;
		corners.push( point.matrixTransform(inv) );
		var max = createPoint(corners[0].x, corners[0].y);
		var min = createPoint(corners[0].x, corners[0].y);

		// identify the new corner coordinates of the
		// fully transformed bounding box
		for (var i = 1; i < corners.length; i++) {
			var x = corners[i].x;
			var y = corners[i].y;
			if (x < min.x) {
				min.x = x;
			}
			else if (x > max.x) {
				max.x = x;
			}
			if (y < min.y) {
				min.y = y;
			}
			else if (y > max.y) {
				max.y = y;
			}
		}

		// return the bounding box as an SVGRect object
		return createRect(min.x, min.y, max.x - min.x, max.y - min.y);
	}
	var containingRect = function (rect1, rect2) {
		var x = Math.min(rect1.x, rect2.x);
		var y = Math.min(rect1.y, rect2.y);
		var width = Math.max(rect1.x + rect1.width, rect2.x + rect2.width) - x;
		var height = Math.max(rect1.y + rect1.height, rect2.y + rect2.height) - y;
		return {x: x, y: y, width: width, height: height};
	};


	var fitTo = function (element, target) {

		function fitToUnitSquare(element, targetBBox) {
			var bbox = element.getBBox();

      // hack: make all lines the same height
      bbox.height = targetBBox.height * .15;
      bbox.y = -bbox.height;

			var translate1 = element.ownerSVGElement.createSVGTransform();
			var scale1 = element.ownerSVGElement.createSVGTransform();
			var translate2 = element.ownerSVGElement.createSVGTransform();
			var scale2 = element.ownerSVGElement.createSVGTransform();

			translate2.setTranslate(targetBBox.x, targetBBox.y);
			//scale2.setScale(targetBBox.width, targetBBox.height);
			scale1.setScale(targetBBox.width / bbox.width, targetBBox.height / bbox.height);
			translate1.setTranslate(-bbox.x, -bbox.y);

			element.transform.baseVal.appendItem(translate2);
			//element.transform.baseVal.appendItem(scale2);

			element.transform.baseVal.appendItem(scale1);
			element.transform.baseVal.appendItem(translate1);
			element.transform.baseVal.consolidate();
		}

		// account for the different transforms of the objects
		var matrix = target.getTransformToElement(element);
		element.transform.baseVal.consolidate();
		var transform = element.transform.baseVal.createSVGTransformFromMatrix(matrix);
		element.transform.baseVal.appendItem(transform);
		element.transform.baseVal.consolidate();

		// account for the different local sizes of the objects
		var targetBBox = target.getBBox();
		fitToUnitSquare(element, targetBBox);
		//Y.SvgUtils.drawBBox(element);

	};

	var drawBBox = function (element) {
		var bbox = element.getBBox();
		var rect = SvgUtils.svgElement('rect');
		rect.setAttribute('x', bbox.x);
		rect.setAttribute('y', bbox.y);
		rect.setAttribute('width', bbox.width);
		rect.setAttribute('height', bbox.height);
		rect.setAttribute('stroke', 'gray');
		rect.setAttribute('fill', 'none');
		rect.setAttribute('transform', element.getAttribute('transform'));
		element.parentElement.appendChild(rect);
		return rect;
	};


  SvgUtils.SVG_NS = SVG_NS;
  SvgUtils.decodeClassValue = decodeClassValue;
  SvgUtils.boundingBox = boundingBox;
  SvgUtils.qscale = qscale;
  SvgUtils.svgElement = svgElement;
  SvgUtils.svgAttrs = svgAttrs;
  SvgUtils.hasClass = hasClass;
  SvgUtils.addClass = addClass;
  SvgUtils.removeClass = removeClass;
  SvgUtils.svgStyles = svgStyles;
  SvgUtils.svg = svg;
  SvgUtils.empty = empty;
  SvgUtils.getScreenBBox = getScreenBBox;
  SvgUtils.containingRect = containingRect;
  SvgUtils.fitTo = fitTo;
  SvgUtils.drawBBox = drawBBox;

})(SvgUtils);
