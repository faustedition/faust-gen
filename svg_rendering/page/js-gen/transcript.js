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
 * @file Abstract transcript layout classes. These classes need to be augmented by methods that do the graphical output.
 * See transcript-svg.js for an SVG implementation.
 */

if (window.FaustTranscript === undefined) {
    window.FaustTranscript = {};
}

(function (FaustTranscript) {

    FaustTranscript.ENCODING_EXCEPTION_PREFIX = "ENCODING ERROR: ";

    /**
     * Base class for all displayed graphical elements (including text, lines, etc.)
     * @constructor
     */
    FaustTranscript.ViewComponent = function () {
        this.classes = [];
        this.initViewComponent();
    };
    FaustTranscript.ViewComponent.prototype = {
        rotation: 0,
        elementName: '',
        /**
         *
         * @returns {number} the global rotation of the element
         */
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
        initViewComponent: function () {
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
        /**
         * Add a child ViewComponent
         * @param {ViewComponent} vc The child to add
         * @returns {ViewComponent} The added child
         */
        add: function (vc) {
            vc.parent = this;
            vc.pos = this.children.length;
            this.children.push(vc);
            vc.defaultAligns();
            return vc;
        },
        /**
         * @returns {ViewComponent} The previous sibling ViewComponent, or null if there is none
         */
        previous: function () {
            return (this.parent == null || this.pos <= 0) ? null : this.parent.children[this.pos - 1];
        },
        /**
         * @returns {ViewComponent} The next sibling ViewComponent, or null if there is none
         */
        next: function () {
            return (this.parent == null || (this.pos + 1) >= this.parent.children.length) ? null : this.parent.children[this.pos + 1];
        },

        /**
         * Layout the ViewComponent by recursively laying out all children and its own graphical elements
         * @returns {FaustTranscript.Dimensions}
         */
        layout: function () {
            this.computeDimension();
            this.computePosition();
            var dimensions = new FaustTranscript.Dimensions();
            if (this.children.length <= 0) {
                // TODO: is this still working as intended?
                dimensions.update(this.x, this.y, this.x + this.width, this.y + this.height);
            } else {

                this.children.forEach(function (c) {
                    //if (!c.layoutSatisfied) {
                    c.layout();
                    dimensions.update(c.x, c.y, c.x + c.width, c.y + c.height);
                    //}
                });
            }

            this.onRelayout();

            return dimensions;
        },
        /**
         * Check if the layout has changed significantly from last iteration, and if not, set a layoutSatisfied flag for
         * the ViewComponent. The idea is that the layout has converged if the change is smaller than a constant
         * epsilon. When setting the layoutSatisfied flag, a logical AND is applied to its previous state, so that
         * multiple calls to checkLayoutDiff must all succeed for layoutSatisfied to be true.
         * @param {number} old Old value for a dimension or position.
         * @param {number} nu  New value for the dimension or position.
         */
        checkLayoutDiff: function (old, nu) {
            var epsilon = 0.01;
            this.layoutSatisfied = this.layoutSatisfied && abs(old - nu) < epsilon;
        },
        /**
         * Compute the dimensions of the ViewComponent and check if layout is finished.
         */
        computeDimension: function () {
            var oldWidth = this.width;
            var oldHeight = this.height;
            //Y.each(this.children, function(c) { c.computeDimension(); });
            this.dimension();
            // Multiple calls to checkLayoutDiff are ANDed
            this.checkLayoutDiff(oldWidth, this.width);
            this.checkLayoutDiff(oldHeight, this.height);
        },

        /**
         * Compute the dimensions of the ViewComponent.
         */
        dimension: function () {
            this.width = 0;
            this.height = 0;
            this.children.forEach(function (c) {
                if (c.width > this.width) {
                    this.width = c.width;
                }
                this.height += c.height;

            }, this);
        },
        /**
         * Compute the position of the ViewComponent and check if layout is finished.
         */
        computePosition: function () {
            var oldX = this.x;
            var oldY = this.y;
            this.position();
            //Y.each(this.children, function(c) { c.computePosition(); });
            this.checkLayoutDiff(oldX, this.x);
            this.checkLayoutDiff(oldY, this.y);
        },
        position: function () {
            this.hAlign.align();
            this.vAlign.align();
        },
        /**
         * Compute the dimensions of the ViewComponent.
         */
        computeClasses: function () {
            return (this.elementName ? ['element-' + this.elementName] : []).concat(this.classes);
        },
        /**
         * @returns {number} The rotation of the local X axis of the ViewComponent's local coordinate system relative
         * to the global coordinate system's X axis
         */
        rotX: function () {
            return 0 + this.globalRotation();
        },
        /**
         * @returns {number} The rotation of the local Y axis of the ViewComponent's local coordinate system relative
         * to the global coordinate system's X axis
         */
        rotY: function () {
            return 90 + this.globalRotation();
        },

        /**
         * Initialize the Aligns that control how the ViewComponent will be aligned to its siblings or parent. For the
         * base class, this is the "block element" align. Child classes can override this
         * method to achieve different alignment (e.g. "inline element" alignment).
         */
        defaultAligns: function () {

            this.setAlign("vAlign", new FaustTranscript.Align(this, this.parent, this.rotY(), 0, 0, FaustTranscript.Align.IMPLICIT_BY_DOC_ORDER));

            if (this.previous()) {
                this.setAlign("hAlign", new FaustTranscript.Align(this, this.previous(), this.rotX(), 0, 1, FaustTranscript.Align.IMPLICIT_BY_DOC_ORDER));
            } else {
                this.setAlign("hAlign", new FaustTranscript.Align(this, this.parent, this.rotX(), 0, 0, FaustTranscript.Align.IMPLICIT_BY_DOC_ORDER));
            }

        },
        /**
         * Add an Align for the ViewComponent. Note that multiple Aligns can be added, so maybe it would have been
         * more aptly named "addAlign"
         * @param name If multiple aligns with the same name exist, only the one with the highest priority is applied
         * @param align An Align instance.
         */
        setAlign: function (name, align) {
            if (this[name]) {

                if (align.priority === this[name].priority) {
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

    /**
     * Base class for block elements, i.e. elements that go below their preceding sibling and align left with their
     * parent.
     */
    FaustTranscript.BlockViewComponent = function () {
        FaustTranscript.BlockViewComponent.superclass.constructor.call(this);
    };

    Y.extend(FaustTranscript.BlockViewComponent, FaustTranscript.ViewComponent);

    FaustTranscript.BlockViewComponent.prototype.defaultAligns = function () {

        this.setAlign("hAlign", new FaustTranscript.Align(this, this.parent, this.rotX(), 0, 0, FaustTranscript.Align.IMPLICIT_BY_DOC_ORDER));

        if (this.previous()) {
            this.setAlign("vAlign", new FaustTranscript.Align(this, this.previous(), this.rotY(), 0, 1, FaustTranscript.Align.IMPLICIT_BY_DOC_ORDER));
        } else {
            this.setAlign("vAlign", new FaustTranscript.Align(this, this.parent, this.rotY(), 0, 0, FaustTranscript.Align.IMPLICIT_BY_DOC_ORDER));
        }
    };
    /**
     * Base class for inline elements, i.e. elements that go to the right of their preceding sibling.
     */

    FaustTranscript.InlineViewComponent = function () {
        FaustTranscript.InlineViewComponent.superclass.constructor.call(this);
    };

    Y.extend(FaustTranscript.InlineViewComponent, FaustTranscript.ViewComponent);

    FaustTranscript.InlineViewComponent.prototype.defaultAligns = function () {

        this.setAlign("vAlign", new FaustTranscript.NullAlign());

        if (this.previous()) {
            this.setAlign("hAlign", new FaustTranscript.Align(this, this.previous(), this.rotX(), 0, 1, FaustTranscript.Align.IMPLICIT_BY_DOC_ORDER));
        } else {
            this.setAlign("hAlign", new FaustTranscript.Align(this, this.parent, this.rotX(), 0, 0, FaustTranscript.Align.IMPLICIT_BY_DOC_ORDER));
        }
    };

    /**
     * A vertical free space (i.e. space between block elements).
     * @param height The height of the VSpace
     */
    FaustTranscript.VSpace = function (height) {
        FaustTranscript.VSpace.superclass.constructor.call(this);
        this.vSpaceHeight = height;
    };

    Y.extend(FaustTranscript.VSpace, FaustTranscript.BlockViewComponent);


    /**
     * A patch glued to the writing surface
     */
    FaustTranscript.Patch = function () {
        FaustTranscript.Patch.superclass.constructor.call(this);
    };

    Y.extend(FaustTranscript.Patch, FaustTranscript.BlockViewComponent);


    /**
     * A horizontal space (inline)
     */
    FaustTranscript.HSpace = function (width) {
        FaustTranscript.HSpace.superclass.constructor.call(this);
        this.hSpaceWidth = width;
    };

    Y.extend(FaustTranscript.HSpace, FaustTranscript.InlineViewComponent);

    /**
     * A writing surface. This will usually be the root of the tree of ViewComponent instances and will in most cases
     * represents a page.
     */
    FaustTranscript.Surface = function () {
        FaustTranscript.Surface.superclass.constructor.call(this);
    };

    Y.extend(FaustTranscript.Surface, FaustTranscript.BlockViewComponent);

    FaustTranscript.Surface.prototype.position = function () {
        this.x = 0;
        this.y = 0;
        // TODO: surface-specific layout
    };

    /**
     * Represents a topographical zone in the transcript
     */
    FaustTranscript.Zone = function () {
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

    /**
     * A line of written text
     * @param lineAttrs Line attributes
     */
    FaustTranscript.Line = function (lineAttrs) {
        FaustTranscript.Line.superclass.constructor.call(this);
        this.lineAttrs = lineAttrs;
    };

    Y.extend(FaustTranscript.Line, FaustTranscript.ViewComponent);

    FaustTranscript.Line.prototype.dimension = function () {
    };

    FaustTranscript.Line.prototype.numberOfPrecedingIntermediateLines = function () {
        if (this.parent == null || this.pos <= 0)
            return 0;
        pre = this.parent.children[this.pos - 1];
        if (typeof pre.lineAttrs !== 'undefined' && pre.lineAttrs['interline'] === true)
            return pre.numberOfPrecedingIntermediateLines() + 1;
        else
            return 0;
    };
    
    FaustTranscript.Line.prototype.previousNonIntermediateLine = function () {
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

    /**
     * Initiates alignment of the line, depending on line attriutes such as "interline", "centered" etc.
     */
    FaustTranscript.Line.prototype.defaultAligns = function () {

        if ("indent" in this.lineAttrs) {
            this.setAlign("hAlign", new FaustTranscript.Align(this, this.parent, this.rotX(), 0, this.lineAttrs["indent"], FaustTranscript.Align.INDENT_ATTR));
        } else if ("indentCenter" in this.lineAttrs) {
            this.setAlign("hAlign", new FaustTranscript.Align(this, this.parent, this.rotX(), 0.5, this.lineAttrs["indentCenter"], FaustTranscript.Align.INDENT_CENTER_ATTR));
        } else {
            this.setAlign("hAlign", new FaustTranscript.Align(this, this.parent, this.rotX(), 0, 0, FaustTranscript.Align.IMPLICIT_BY_DOC_ORDER));
        }

        INTERLINE_DISTANCE = 0.58;
        REGULAR_LINE_DISTANCE = 1;

        if (this.previous()) {
            var yourJoint = this.lineAttrs['interline'] ? (this.numberOfPrecedingIntermediateLines() + 1) * INTERLINE_DISTANCE :
                (Math.max(0, this.numberOfPrecedingIntermediateLines() - 1) * INTERLINE_DISTANCE) + REGULAR_LINE_DISTANCE;
            if (Faust.TranscriptConfiguration.overlay === "overlay") {
                //yourJoint = ("between" in this.lineAttrs)? 1 : 1;
                yourJoint = ("over" in this.lineAttrs) ? 0.1 : yourJoint;
            } else {
                yourJoint = ("between" in this.lineAttrs) ? 0.7 : yourJoint;
                yourJoint = ("over" in this.lineAttrs) ? 0.5 : yourJoint;
            }

            this.setAlign("vAlign", new FaustTranscript.Align(this, this.previousNonIntermediateLine(), this.rotY(), 0, yourJoint, FaustTranscript.Align.IMPLICIT_BY_DOC_ORDER));

        } else {
            this.setAlign("vAlign", new FaustTranscript.Align(this, this.parent, this.rotY(), 0, 0, FaustTranscript.Align.IMPLICIT_BY_DOC_ORDER));
        }
    };

    /**
     * An atomic piece of text that can be aligned, styled, decorated etc.
     * @param {string} text The text to be displayed
     */
    FaustTranscript.Text = function (text) {
        FaustTranscript.Text.superclass.constructor.call(this);
        this.decorations = [];
        this.text = text.replace(/\s+/g, "\u00a0");
        this.textElement = null;
    };

    Y.extend(FaustTranscript.Text, FaustTranscript.InlineViewComponent);

    FaustTranscript.Text.prototype.dimension = function () {
        var measured = this.measure();
        this.width = measured.width;
        this.height = measured.height;
    };

    /**
     * A free floating ViewComponent that will be taken out of the normal alignment flow.
     * @param classes
     * @param floatParent
     */
    FaustTranscript.FloatVC = function (classes, floatParent) {
        FaustTranscript.FloatVC.superclass.constructor.call(this);
        this.classes = this.classes.concat(classes);
        this.floatParent = floatParent;
    };

    Y.extend(FaustTranscript.FloatVC, FaustTranscript.ViewComponent);

    FaustTranscript.FloatVC.prototype.globalRotation = function () {
        // Floats are always global
        return this.rotation;
    };

    /**
     * A floating image
     * @param type
     * @param classes
     * @param imageUrl
     * @param fixedWidth
     * @param fixedHeight
     * @param floatParent
     * @constructor
     */
    FaustTranscript.CoveringImage = function (type, classes, imageUrl, fixedWidth, fixedHeight, floatParent) {
        FaustTranscript.CoveringImage.superclass.constructor.call(this, classes, floatParent);
        this.type = type;
        this.imageUrl = imageUrl;
        this.fixedWidth = fixedWidth;
        this.fixedHeight = fixedHeight;
        this.coveredVCs = [];
        this.classes.push('use-image');
    };

    Y.extend(FaustTranscript.CoveringImage, FaustTranscript.FloatVC);

    FaustTranscript.StretchingImage = function (type, classes, imageUrl, fixedWidth, fixedHeight, floatParent) {
        FaustTranscript.StretchingImage.superclass.constructor.call(this, classes, floatParent);
        this.type = type;
        this.imageUrl = imageUrl;
        this.fixedWidth = fixedWidth;
        this.fixedHeight = fixedHeight;
        this.coveredVCs = [];
        this.classes.push('use-image');
    };

    Y.extend(FaustTranscript.StretchingImage, FaustTranscript.FloatVC);


    FaustTranscript.SpanningVC = function (type, imageUrl, imageWidth, imageHeight, fixedWidth, fixedHeight) {
        FaustTranscript.SpanningVC.superclass.constructor.call(this);
        this.type = type;
        this.imageUrl = imageUrl;
        this.imageWidth = imageWidth;
        this.imageHeight = imageHeight;
        this.fixedWidth = fixedWidth;
        this.fixedHeight = fixedHeight;
        this.classes.push('use-image');
    };

    Y.extend(FaustTranscript.SpanningVC, FaustTranscript.ViewComponent);

    /**
     * Base class for inline decorations such as circles or rectangles around text
     * @param classes
     * @constructor
     */

    FaustTranscript.InlineDecoration = function (classes) {
        FaustTranscript.InlineDecoration.superclass.constructor.call(this);
        this.classes = this.classes.concat(classes);
        this.classes.push('inline-decoration');
    };

    Y.extend(FaustTranscript.InlineDecoration, FaustTranscript.InlineViewComponent);

    /**
     * An inline rectangle decoration around text
     * @param classes
     * @constructor
     */
    FaustTranscript.RectInlineDecoration = function (classes) {
        FaustTranscript.RectInlineDecoration.superclass.constructor.call(this);
        this.classes.push('inline-decoration-type-rect');
    };

    Y.extend(FaustTranscript.RectInlineDecoration, FaustTranscript.InlineDecoration);

    /**
     * An inline circle decoration around text
     * @param classes
     * @constructor
     */
    FaustTranscript.CircleInlineDecoration = function (classes) {
        FaustTranscript.CircleInlineDecoration.superclass.constructor.call(this);
        this.classes.push('inline-decoration-type-circle');
    };

    Y.extend(FaustTranscript.CircleInlineDecoration, FaustTranscript.InlineDecoration);

    /**
     * An inline graphic or image
     * @param type
     * @param imageUrl
     * @param imageWidth
     * @param imageHeight
     * @param displayWidth
     * @param displayHeight
     * @constructor
     */
    FaustTranscript.InlineGraphic = function (type, imageUrl, imageWidth, imageHeight, displayWidth, displayHeight) {
        FaustTranscript.InlineGraphic.superclass.constructor.call(this);
        this.type = type;
        this.imageUrl = imageUrl;
        this.imageWidth = imageWidth;
        this.imageHeight = imageHeight;
        this.displayWidth = displayWidth;
        this.displayHeight = displayHeight;
        this.classes.push('use-image');
    };

    Y.extend(FaustTranscript.InlineGraphic, FaustTranscript.InlineViewComponent);

    /**
     * A graphical line such as squiggles
     * @constructor
     */
    FaustTranscript.GLine = function () {
        FaustTranscript.GLine.superclass.constructor.call(this);
    };

    Y.extend(FaustTranscript.GLine, FaustTranscript.ViewComponent);

    FaustTranscript.GLine.prototype.dimension = function () {
        this.width = 40;
        this.height = 20;
    };

    /**
     * A graphical brace spanning a bigger part of the surface
     * @constructor
     */
    FaustTranscript.GBrace = function () {
        FaustTranscript.GBrace.superclass.constructor.call(this);
    };

    Y.extend(FaustTranscript.GBrace, FaustTranscript.ViewComponent);

    FaustTranscript.GBrace.prototype.dimension = function () {
        this.width = 40;
        this.height = 20;
    };

    /**
     * Base class for text decoration
     * @param {Text} text The text to be decorated
     * @param classes
     * @constructor
     */
    FaustTranscript.TextDecoration = function (text, classes) {
        this.text = text;
        this.classes = classes;
        this.classes.push('text-decoration');
    };

    FaustTranscript.TextDecoration.prototype.layout = function () {
    };

    FaustTranscript.NullDecoration = function (text, classes, name) {
        FaustTranscript.NullDecoration.superclass.constructor.call(this, text, classes.concat(['text-decoration-type-' + name]));
    };
    Y.extend(FaustTranscript.NullDecoration, FaustTranscript.TextDecoration);

    /**
     * A line decorating text
     * @param text The text to be decorated
     * @param classes
     * @param name
     * @param yOffset How high the line should be set, to enable underline, strike-through, overline etc.
     * @constructor
     */
    FaustTranscript.LineDecoration = function (text, classes, name, yOffset) {
        FaustTranscript.LineDecoration.superclass.constructor.call(this, text, classes.concat(['text-decoration-type-' + name]));
        this.yOffset = yOffset;
    };
    Y.extend(FaustTranscript.LineDecoration, FaustTranscript.TextDecoration);

    /**
     * A decoration that duplicates text, to be used for doubly-written ("overwritten") text
     * @param text The text to be decorated
     * @param classes
     * @param name
     * @param xOffset
     * @param yOffset
     * @constructor
     */
    FaustTranscript.CloneDecoration = function (text, classes, name, xOffset, yOffset) {
        FaustTranscript.CloneDecoration.superclass.constructor.call(this, text, classes.concat(['text-decoration-type-' + name]));
        this.xOffset = xOffset;
        this.yOffset = yOffset;
    };
    Y.extend(FaustTranscript.CloneDecoration, FaustTranscript.TextDecoration);

    /**
     * An Align controls the positioning of a ViewComponent along one axis w.r.t. to another ViewComponent, usually its
     * parent or sibling. Multiple Aligns can be applied to a single ViewComponent (e.g. for x- and y-positioning)
     * @param {ViewComponent} me The ViewComponent to be positioned
     * @param {ViewComponent} you The ViewComponent to be aligned against
     * @param {number} coordRotation The axis along which to align (TODO in which coordinate system?)
     * @param {number} myJoint A number that determines at which point on the axis the "me"
     * ViewComponent will be aligned with "yourJoint" of the "you" ViewComponent. For example, if "coordRotation"
     * specifies the y-axis, then 0 means the top of the "me" ViewComponent and 1 means the bottom, 0.5 means the middle,
     * 2 means one height below the bottom of ViewComponent etc. The bounding box in local coordinate system is used.
     * @param {number} yourJoint See "myJoint"
     * @param {number} priority In the case of two or more conflicting Aligns, only the one with the highest priority
     * should be applied (by code using Aligns)
     * @constructor
     */
    FaustTranscript.Align = function (me, you, coordRotation, myJoint, yourJoint, priority) {
        this.me = me;
        this.you = you;
        this.coordRotation = coordRotation;
        this.myJoint = myJoint;
        this.yourJoint = yourJoint;
        this.priority = priority;
    };

    // Constants for priority
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


    FaustTranscript.Align.prototype.align = function () {
        var value = this.you.getCoord(this.coordRotation);
        value -= this.myJoint * this.me.getExt(this.coordRotation);
        value += this.yourJoint * this.you.getExt(this.coordRotation);
        this.me.setCoord(value, this.coordRotation);
    };

    /**
     * An align that sets absolute coordinates
     * @param me
     * @param coordRotation
     * @param coordinate
     * @param priority
     * @constructor
     */
    FaustTranscript.AbsoluteAlign = function (me, coordRotation, coordinate, priority) {
        this.me = me;
        this.coordRotation = coordRotation;
        this.coordinate = coordinate;
        this.priority = priority;
    };

    FaustTranscript.AbsoluteAlign.prototype.align = function () {
        this.me.setCoord(this.coordinate, this.coordRotation);
    };

    FaustTranscript.NullAlign = function (priority) {
        this.priority = priority;
    };

    FaustTranscript.NullAlign.prototype.align = function () {
    };

    /**
     * Represents the dimensions of a ViewComponent
     * @constructor
     */
    FaustTranscript.Dimensions = function () {
    };

    FaustTranscript.Dimensions.prototype = function () {
    };

    FaustTranscript.Dimensions.prototype.update = function (xMin, yMin, xMax, yMax) {

        if (!this.xMin || this.xMin > xMin) {
            this.xMin = xMin;
        }

        if (!this.yMin || this.yMin > yMin) {
            this.yMin = yMin;
        }

        if (!this.xMax || this.xMax < xMax) {
            this.xMax = xMax;
        }

        if (!this.yMax || this.yMax < yMax) {
            this.yMax = yMax;
        }
    };

})(FaustTranscript);

