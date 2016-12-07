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

if(window.FaustTranscript === undefined) {
  window.FaustTranscript = {};
}

(function(FaustTranscript) {

	FaustTranscript.ENCODING_EXCEPTION_PREFIX = "ENCODING ERROR: ";

	FaustTranscript.ViewComponent = function() {
		this.classes = [];
		this.initViewComponent();
	};
	FaustTranscript.ViewComponent.prototype = {
		rotation: 0,
		elementName: '',
		globalRotation: function () {
			var e = this;
			var result = 0;
			while (e.parent) {
				result += e.rotation;
				e = e.parent;
			}
			result += e.rotation;
			return result;
		},
		initViewComponent: function() {
			//this.parent = null;
			this.pos = -1;
			this.children = [];			
			
			this.x = 0;
			this.y = 0;
			this.width = 0;
			this.height = 0;
			//this.hAlign = null;
			//this.vAlign = null;
		},
		add: function(vc) {
			vc.parent = this;
			vc.pos = this.children.length;
			this.children.push(vc);
			vc.defaultAligns();
			return vc;
		},
		previous: function() {
			return (this.parent == null || this.pos <= 0) ? null : this.parent.children[this.pos - 1];
		},
		next: function() {
			return (this.parent == null || (this.pos + 1) >= this.parent.children.length) ? null : this.parent.children[this.pos + 1];			
		},
		layout: function() {
			this.computeDimension();			
			this.computePosition();
			var dimensions = new FaustTranscript.Dimensions();
			if (this.children.length <= 0) {
				dimensions.update(this.x, this.y, this.x + this.width, this.y + this.height);
      } else {
				
				this.children.forEach(function(c) {
					//if (!c.layoutSatisfied) {
					c.layout();
					dimensions.update (c.x, c.y, c.x + c.width, c.y + c.height);
					//}
				});	
			}
			
			this.onRelayout();

			return dimensions;
		},
		checkLayoutDiff: function(old, nu) {
			var epsilon = 0.01;
			this.layoutSatisfied = this.layoutSatisfied && abs(old - nu) < epsilon;  
		},
		computeDimension: function() {
			var oldWidth = this.width;
			var oldHeight = this.height;
			//Y.each(this.children, function(c) { c.computeDimension(); });
			this.dimension();
			this.checkLayoutDiff(oldWidth, this.width);
			this.checkLayoutDiff(oldHeight, this.height);
		},
		dimension: function() {
			this.width = 0;
			this.height = 0;
			this.children.forEach(function(c) {
				if (c.width > this.width) {
          this.width = c.width;
        }
				this.height += c.height;
				
			}, this);			
		},
		computePosition: function() {
			var oldX = this.x;
			var oldY = this.y;
			this.position();
			//Y.each(this.children, function(c) { c.computePosition(); });
			this.checkLayoutDiff(oldX, this.x);
			this.checkLayoutDiff(oldY, this.y);
		},
		position: function() {
			this.hAlign.align();
			this.vAlign.align();
		},
		computeClasses: function() { 
			return (this.elementName ? ['element-' + this.elementName] : []).concat(this.classes);
		},
		rotX: function() {return 0 + this.globalRotation();},
		rotY: function() {return 90 + this.globalRotation();},
		
 		defaultAligns: function () {
 		
 			this.setAlign("vAlign", new FaustTranscript.Align(this, this.parent, this.rotY(), 0, 0, FaustTranscript.Align.IMPLICIT_BY_DOC_ORDER));

 			if (this.previous()) {
 				this.setAlign("hAlign", new FaustTranscript.Align(this, this.previous(), this.rotX(), 0, 1, FaustTranscript.Align.IMPLICIT_BY_DOC_ORDER));
      } else {
 				this.setAlign("hAlign", new FaustTranscript.Align(this, this.parent, this.rotX(), 0, 0, FaustTranscript.Align.IMPLICIT_BY_DOC_ORDER));
      }

		},
		setAlign: function (name, align) {
			if (this[name]) {
				
				if (align.priority === this[name].priority){
					var xmlId = this.xmlId ? this.xmlId : '';
					throw(FaustTranscript.ENCODING_EXCEPTION_PREFIX + "Conflicting alignment instructions for element "
							+ this.elementName + " #" + xmlId + " (" + name + ", " 
							+ FaustTranscript.Align[align.priority] + " )");
				} else if (align.priority > this[name].priority) {
					this[name] = align;
        }
			} else {
				this[name] = align;
      }
		}
	};

	FaustTranscript.BlockViewComponent = function() {
		FaustTranscript.BlockViewComponent.superclass.constructor.call(this);
	};

	Y.extend (FaustTranscript.BlockViewComponent, FaustTranscript.ViewComponent);

	FaustTranscript.BlockViewComponent.prototype.defaultAligns = function () {
		
		this.setAlign("hAlign", new FaustTranscript.Align(this, this.parent, this.rotX(), 0, 0, FaustTranscript.Align.IMPLICIT_BY_DOC_ORDER));
		
		if (this.previous()) {
			this.setAlign("vAlign", new FaustTranscript.Align(this, this.previous(), this.rotY(), 0, 1, FaustTranscript.Align.IMPLICIT_BY_DOC_ORDER));
    } else {
			this.setAlign("vAlign", new FaustTranscript.Align(this, this.parent, this.rotY(), 0, 0, FaustTranscript.Align.IMPLICIT_BY_DOC_ORDER));
    }
 	};

	FaustTranscript.InlineViewComponent = function() {
		FaustTranscript.InlineViewComponent.superclass.constructor.call(this);
	};

	Y.extend (FaustTranscript.InlineViewComponent, FaustTranscript.ViewComponent);

	FaustTranscript.InlineViewComponent.prototype.defaultAligns = function () {

		this.setAlign("vAlign", new FaustTranscript.NullAlign());

		if (this.previous()) {
			this.setAlign("hAlign", new FaustTranscript.Align(this, this.previous(), this.rotX(), 0, 1, FaustTranscript.Align.IMPLICIT_BY_DOC_ORDER));
    } else {
			this.setAlign("hAlign", new FaustTranscript.Align(this, this.parent, this.rotX(), 0, 0, FaustTranscript.Align.IMPLICIT_BY_DOC_ORDER));
    }
	};

	FaustTranscript.VSpace = function(height) {
		FaustTranscript.VSpace.superclass.constructor.call(this);
		this.vSpaceHeight = height;
	};

	Y.extend (FaustTranscript.VSpace, FaustTranscript.BlockViewComponent);


	FaustTranscript.Patch = function() {
		FaustTranscript.Patch.superclass.constructor.call(this);
	};

	Y.extend (FaustTranscript.Patch, FaustTranscript.BlockViewComponent);


	FaustTranscript.HSpace = function(width) {
		FaustTranscript.HSpace.superclass.constructor.call(this);
		this.hSpaceWidth = width;
	};
	
	Y.extend (FaustTranscript.HSpace, FaustTranscript.InlineViewComponent);

	FaustTranscript.Surface = function() {
		FaustTranscript.Surface.superclass.constructor.call(this);
	};

	Y.extend(FaustTranscript.Surface, FaustTranscript.BlockViewComponent);

	FaustTranscript.Surface.prototype.position = function() {
		this.x = 0;
		this.y = 0;
		// TODO: surface-specific layout
	};


			
	FaustTranscript.Zone = function() {
		FaustTranscript.Zone.superclass.constructor.call(this);
		this.floats = [];
	};

	Y.extend(FaustTranscript.Zone, FaustTranscript.BlockViewComponent);

	FaustTranscript.Zone.prototype.addFloat = function (vc) {
		vc.parent = this;
		vc.pos = this.children.length;
		this.floats.push(vc);
		vc.defaultAligns();
		return vc;
	};

	FaustTranscript.Zone.prototype.layout = function () {
		FaustTranscript.Zone.superclass.layout.call(this);
		this.floats.forEach(function (float) {
			float.layout();
		});
	};
	
	FaustTranscript.Line = function(lineAttrs) {
		FaustTranscript.Line.superclass.constructor.call(this);
		this.lineAttrs = lineAttrs;
	};

	Y.extend(FaustTranscript.Line, FaustTranscript.ViewComponent);

	FaustTranscript.Line.prototype.dimension = function() {
	};

	FaustTranscript.Line.prototype.previousNonIntermediateLine = function() {
		if (this.pos == 1)
			return this.parent.children[0];
		if (this.parent == null || this.pos <= 0)
			return null;
		pre = this.parent.children[this.pos - 1];

		if (typeof pre.lineAttrs !== 'undefined' && pre.lineAttrs['interline'] === true)
			return pre.previousNonIntermediateLine();
		else
			return pre;
	};

 	FaustTranscript.Line.prototype.defaultAligns = function () {
			
		if ("indent" in this.lineAttrs) {
			this.setAlign("hAlign", new FaustTranscript.Align(this, this.parent, this.rotX(), 0, this.lineAttrs["indent"], FaustTranscript.Align.INDENT_ATTR));
		} else if ("indentCenter" in this.lineAttrs) {
			this.setAlign("hAlign", new FaustTranscript.Align(this, this.parent, this.rotX(), 0.5, this.lineAttrs["indentCenter"], FaustTranscript.Align.INDENT_CENTER_ATTR));
		} else {
			this.setAlign("hAlign", new FaustTranscript.Align(this, this.parent, this.rotX(), 0, 0, FaustTranscript.Align.IMPLICIT_BY_DOC_ORDER));
		}

 		
		if (this.previous()) {
			var yourJoint = this.lineAttrs['interline'] ? 0.75 : 1.5;;
			if (Faust.TranscriptConfiguration.overlay === "overlay") {
				//yourJoint = ("between" in this.lineAttrs)? 1 : 1;				
				yourJoint = ("over" in this.lineAttrs)? 0.1 : yourJoint;
			} else {
				yourJoint = ("between" in this.lineAttrs)? 0.7 : yourJoint;
				yourJoint = ("over" in this.lineAttrs)? 0.5 : yourJoint;
			}
									
			this.setAlign("vAlign", new FaustTranscript.Align(this, this.previousNonIntermediateLine(), this.rotY(), 0, yourJoint, FaustTranscript.Align.IMPLICIT_BY_DOC_ORDER));

		} else {
			this.setAlign("vAlign", new FaustTranscript.Align(this, this.parent, this.rotY(), 0, 0, FaustTranscript.Align.IMPLICIT_BY_DOC_ORDER));
    }
	};

	FaustTranscript.Text = function(text) {
		FaustTranscript.Text.superclass.constructor.call(this);
		this.decorations = [];
		this.text = text.replace(/\s+/g, "\u00a0");
		this.textElement = null;
	};

	Y.extend(FaustTranscript.Text, FaustTranscript.InlineViewComponent);

	FaustTranscript.Text.prototype.dimension = function() {
		var measured = this.measure();
		this.width = measured.width;
		this.height = measured.height;
	};

	FaustTranscript.FloatVC = function(classes, floatParent) {
		FaustTranscript.FloatVC.superclass.constructor.call(this);
		this.classes = this.classes.concat(classes);
		this.floatParent = floatParent;
	};

	Y.extend (FaustTranscript.FloatVC, FaustTranscript.ViewComponent);

	FaustTranscript.FloatVC.prototype.globalRotation = function() {
		// Floats are always global
		return this.rotation;
	};

	FaustTranscript.CoveringImage = function(type, classes, imageUrl, fixedWidth, fixedHeight, floatParent) {
		FaustTranscript.CoveringImage.superclass.constructor.call(this, classes, floatParent);
		this.type =  type;
		this.imageUrl = imageUrl;
		this.fixedWidth = fixedWidth;
		this.fixedHeight = fixedHeight;
		this.coveredVCs = [];
		this.classes.push('use-image');
	};

	Y.extend (FaustTranscript.CoveringImage, FaustTranscript.FloatVC);

	FaustTranscript.StretchingImage = function(type, classes, imageUrl, fixedWidth, fixedHeight, floatParent) {
			FaustTranscript.StretchingImage.superclass.constructor.call(this, classes, floatParent);
			this.type =  type;
			this.imageUrl = imageUrl;
			this.fixedWidth = fixedWidth;
			this.fixedHeight = fixedHeight;
			this.coveredVCs = [];
			this.classes.push('use-image');
	};

	Y.extend(FaustTranscript.StretchingImage, FaustTranscript.FloatVC);


	FaustTranscript.SpanningVC = function(type, imageUrl, imageWidth, imageHeight, fixedWidth, fixedHeight) {
		FaustTranscript.SpanningVC.superclass.constructor.call(this);
		this.type =  type;
		this.imageUrl = imageUrl;
		this.imageWidth = imageWidth;
		this.imageHeight = imageHeight;
		this.fixedWidth = fixedWidth;
		this.fixedHeight = fixedHeight;
		this.classes.push('use-image');
	};

	Y.extend (FaustTranscript.SpanningVC, FaustTranscript.ViewComponent);

	FaustTranscript.InlineDecoration = function(classes) {
		FaustTranscript.InlineDecoration.superclass.constructor.call(this);
		this.classes = this.classes.concat(classes);
		this.classes.push('inline-decoration');
	};

	Y.extend (FaustTranscript.InlineDecoration, FaustTranscript.InlineViewComponent);

	FaustTranscript.RectInlineDecoration = function(classes) {
		FaustTranscript.RectInlineDecoration.superclass.constructor.call(this);
		this.classes.push('inline-decoration-type-rect');
	};

	Y.extend (FaustTranscript.RectInlineDecoration, FaustTranscript.InlineDecoration);

	FaustTranscript.CircleInlineDecoration = function(classes) {
		FaustTranscript.CircleInlineDecoration.superclass.constructor.call(this);
		this.classes.push('inline-decoration-type-circle');
	};

	Y.extend (FaustTranscript.CircleInlineDecoration, FaustTranscript.InlineDecoration);


	FaustTranscript.InlineGraphic = function(type, imageUrl, imageWidth, imageHeight, displayWidth, displayHeight) {
		FaustTranscript.InlineGraphic.superclass.constructor.call(this);
		this.type =  type;
		this.imageUrl = imageUrl;
		this.imageWidth = imageWidth;
		this.imageHeight = imageHeight;
		this.displayWidth = displayWidth;
		this.displayHeight = displayHeight;
		this.classes.push('use-image');
	};

	Y.extend (FaustTranscript.InlineGraphic, FaustTranscript.InlineViewComponent);

	FaustTranscript.GLine = function() {
		FaustTranscript.GLine.superclass.constructor.call(this);
	};

	Y.extend(FaustTranscript.GLine, FaustTranscript.ViewComponent);

	FaustTranscript.GLine.prototype.dimension = function() {
		this.width = 40;
		this.height = 20;
	};


	FaustTranscript.GBrace = function() {
		FaustTranscript.GBrace.superclass.constructor.call(this);
	};

	Y.extend(FaustTranscript.GBrace, FaustTranscript.ViewComponent);

	FaustTranscript.GBrace.prototype.dimension = function() {
		this.width = 40;
		this.height = 20;
	};

	FaustTranscript.TextDecoration = function(text, classes) {
		this.text = text;
		this.classes = classes;
		this.classes.push('text-decoration');
	};

	FaustTranscript.TextDecoration.prototype.layout = function() {};

	FaustTranscript.NullDecoration = function (text, classes, name) {
		FaustTranscript.NullDecoration.superclass.constructor.call(this, text, classes.concat(['text-decoration-type-' + name]));
	};
	Y.extend(FaustTranscript.NullDecoration, FaustTranscript.TextDecoration);

	FaustTranscript.LineDecoration = function (text, classes, name, yOffset) {
		FaustTranscript.LineDecoration.superclass.constructor.call(this, text, classes.concat(['text-decoration-type-' + name]));
		this.yOffset = yOffset;
	};
	Y.extend(FaustTranscript.LineDecoration, FaustTranscript.TextDecoration);

	FaustTranscript.CloneDecoration = function (text, classes, name, xOffset, yOffset) {
		FaustTranscript.CloneDecoration.superclass.constructor.call(this, text, classes.concat(['text-decoration-type-' + name]));
		this.xOffset = xOffset;
		this.yOffset = yOffset;
	};
	Y.extend(FaustTranscript.CloneDecoration, FaustTranscript.TextDecoration);

	FaustTranscript.Align = function(me, you, coordRotation, myJoint, yourJoint, priority) {
		this.me = me;
		this.you = you;
		this.coordRotation = coordRotation;
		this.myJoint = myJoint;
		this.yourJoint = yourJoint;
		this.priority = priority;
	};
	
	FaustTranscript.Align.IMPLICIT_BY_DOC_ORDER = 0;
	FaustTranscript.Align['0'] = 'IMPLICIT_BY_DOC_ORDER';
	FaustTranscript.Align.REND_ATTR = 5;
	FaustTranscript.Align['5'] = 'REND_ATTR';
	FaustTranscript.Align.INDENT_ATTR = 7;
	FaustTranscript.Align['7'] = 'INDENT_ATTR';
	FaustTranscript.Align.INDENT_ATTR = 7;
	FaustTranscript.Align['8'] = 'INDENT_CENTER_ATTR';
	FaustTranscript.Align.EXPLICIT = 10;
	FaustTranscript.Align['10'] = 'EXPLICIT';
	FaustTranscript.Align.MAIN_ZONE = 15;
	FaustTranscript.Align['15'] = 'MAIN_ZONE';

	
	FaustTranscript.Align.prototype.align = function() {
		var value = this.you.getCoord(this.coordRotation);
		value -= this.myJoint * this.me.getExt(this.coordRotation);
		value += this.yourJoint * this.you.getExt(this.coordRotation);
		this.me.setCoord(value, this.coordRotation);
	};

	FaustTranscript.AbsoluteAlign = function (me, coordRotation, coordinate, priority) {
		this.me = me;
		this.coordRotation = coordRotation;
		this.coordinate = coordinate;
		this.priority = priority;
	};
	
	FaustTranscript.AbsoluteAlign.prototype.align = function() {
		this.me.setCoord(this.coordinate, this.coordRotation);
	};

	FaustTranscript.NullAlign = function (priority) {
		this.priority = priority;
	};

	FaustTranscript.NullAlign.prototype.align = function() {
	};

	FaustTranscript.Dimensions = function() {};

	FaustTranscript.Dimensions.prototype = function() {};
	
	FaustTranscript.Dimensions.prototype.update = function(xMin, yMin, xMax, yMax) {

		if (!this.xMin || this.xMin > xMin ) {
			this.xMin = xMin;
    }
		
		if (!this.yMin || this.yMin > yMin ) {
			this.yMin = yMin;
    }

 		if (!this.xMax || this.xMax < xMax ) {
			this.xMax = xMax;
    }

 		if (!this.yMax || this.yMax < yMax ) {
			this.yMax = yMax;
    }
	};

})(FaustTranscript);

