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
 * @file Initialize layout objects from document tree
 */

if (window.FaustTranscript === undefined) {
    window.FaustTranscript = {};
}
if (window.Faust === undefined) {
    window.Faust = {};
}

(function (Faust) {

    var TranscriptLayout = {
        /**
         * Text factory; the current model only delivers text nodes, some additional elements (gaps, insertion marks)
         * need to be delivered to know their tree context (hands...) for visualisation
         */
        createText: function (content, start, end, text, layoutState) {
            if (content.length < 1) {
                throw "Cannot create empty text!";
            }
            var textAttrs = {};
            var annotations = text.find(start, end)
            //ignore empty annotations at the borders
                .filter(function (x) {
                    var r = x.target().range;
                    return r.start !== r.end;
                });

            var textVC = new FaustTranscript.Text(content, textAttrs);

            // reset custom state of current text representation
            if (typeof layoutState !== 'undefined')
                layoutState.textState = {};
            annotations.forEach(function (annotation) {
                if (annotation.name.localName in Faust.TranscriptConfiguration.names
                    && Faust.TranscriptConfiguration.names[annotation.name.localName].text) {
                    Faust.TranscriptConfiguration.names[annotation.name.localName].text(annotation, textVC, layoutState);
                }
            });

            return textVC;
        }

    };

    Faust.TranscriptLayout = TranscriptLayout;

})(Faust);



(function (FaustTranscript) {

    /**
     * Initialize a ViewComponent tree from an AdhocTree
     * @constructor
     */
    var TranscriptAdhocTree = function () {
        this.mainZone = null;
        this.postBuildDeferred = [];
    };

    Y.extend(TranscriptAdhocTree, Object, {

        /**
         * Walk an AdhocTree and construct a tree of ViewComponents. The global object
         * Faust.TranscriptConfiguration.names can be set up to provide callback functions that will be called when
         * a certain annotation node is encountered. The keys in Faust.TranscriptConfiguration.names correspond to the
         * local annotation name. Behind the key can be an object with the following callback functions:
         *
         * vc (node, text, layoutState) will construct and return the ViewComponent object
         *
         * start (vc, node, text, layoutState) will be called after the ViewComponent has been added to the layout tree
         *                                     but before any children have been added. This is the place where elements
         *                                     can be added that go to the beginning of the ViewComponent
         *
         * end (vc, node, text, layoutState)   will be called after the ViewComponent has been added to the layout tree
         *                                     and after any children have been added. This is the place where elements
         *                                     can be added that go to the end of the ViewComponent
         *
         * text (annotation, textVC) will be called when a text node is encountered and addedwhile traversing the tree.
         *                           This can be used to modify the properties of the text according to the annotation.
         *
         * @param {ViewComponent} parent
         * @param {AnnotationNode} node
         * @param {Text} text The standoff-annotated text
         * @param layoutState An object that stores variables global w.r.t. one layout process
         * @returns {*}
         */
        buildVC: function (parent, node, text, layoutState) {

            if (node == null) {
                return null;
            }

            var vc = null;


            var ancestorNames = node.ancestors().map(function (node) {
                return node.annotation.name.localName
            });
            if ((node instanceof Faust.TextNode) && (parent != null) && (ancestorNames.indexOf('line') >= 0)) {
                if (Faust.TranscriptConfiguration.stripWhitespace.indexOf(node.parent.name().localName) >= 0 && node.content().trim() == "") {
                    //only whitespace to be stripped, do not return a text representation
                } else {
                    vc = Faust.TranscriptLayout.createText(node.content(), node.range.start, node.range.end, text, layoutState);
                }
            } else if (node instanceof Faust.AnnotationNode) {

                var annotationStart = node.annotation.target().range.start;
                var annotationEnd = node.annotation.target().range.end;

                //ioc: configurable modules handle the construction of the view

                // call 'vc' callback to construct the view component

                if (node.name().localName in Faust.TranscriptConfiguration.names
                    && 'vc' in Faust.TranscriptConfiguration.names[node.name().localName]) {
                    var nameHandler = Faust.TranscriptConfiguration.names[node.name().localName];
                    if (nameHandler.vc) {
                        vc = nameHandler.vc(node, text, layoutState);
                    } else {
                        vc = new FaustTranscript.InlineViewComponent();
                    }
                }

                var aligningAttributes = ["f:at", "f:left", "f:left-right", "f:right", "f:right-left", "f:top", "f:top-bottom", "f:bottom", "f:bottom-top"];

                var that = this;

                aligningAttributes.forEach(function (a) {
                    if (a in node.data()) {
                        if (!vc) {
                            vc = new FaustTranscript.InlineViewComponent();
                        }
                        //FIXME id hash hack; do real resolution of references
                        var anchorId = node.data()[a].substring(1);
                        var coordRot = a in {
                            "f:at": 1,
                            "f:left": 1,
                            "f:left-right": 1,
                            "f:right": 1,
                            "f:right-left": 1
                        } ? 0 : 90;
                        var alignName = coordRot == 0 ? "hAlign" : "vAlign";
                        var myJoint = a in {"f:left": 1, "f:left-right": 1, "f:top": 1, "f:top-bottom": 1} ? 0 : 1;
                        var yourJoint = a in {
                            "f:at": 1,
                            "f:left": 1,
                            "f:right-left": 1,
                            "f:top": 1,
                            "f:bottom-top": 1
                        } ? 0 : 1;

                        if ("f:orient" in node.data())
                            myJoint = node.data()["f:orient"] == "left" ? 1 : 0;

                        that.postBuildDeferred.push(
                            function () {
                                var anchor = layoutState.idMap[anchorId];
                                if (!anchor)
                                    throw (FaustTranscript.ENCODING_EXCEPTION_PREFIX + "Reference to #" + anchorId + " cannot be resolved!");
                                var globalCoordRot = coordRot + anchor.globalRotation();
                                vc.setAlign(alignName, new FaustTranscript.Align(vc, anchor, globalCoordRot, myJoint, yourJoint, FaustTranscript.Align.EXPLICIT));
                            });
                    }
                });

                // TODO special treatment of zones
                if ("rend" in node.data()) {
                    if (node.data()["rend"] == "right") {
                        vc.setAlign("hAlign", new FaustTranscript.Align(vc, parent, parent.globalRotation(), 1, 1, FaustTranscript.Align.REND_ATTR));
                    } else if (node.data()["rend"] == "left") {
                        vc.setAlign("hAlign", new FaustTranscript.Align(vc, parent, parent.globalRotation(), 0, 0, FaustTranscript.Align.REND_ATTR));
                    } else if (node.data()["rend"] == "centered") {
                        vc.setAlign("hAlign", new FaustTranscript.Align(vc, parent, parent.globalRotation(), 0.5, 0.5, FaustTranscript.Align.REND_ATTR));
                    }


                }
            }

            if (vc != null) {

                // annotate the vc with the original element name
                vc.elementName = node.name ? node.name().localName : "";

                // add view component to parent
                if (parent != null) {
                    parent.add(vc);
                    vc.parent = parent;
                }
                parent = vc;
            }

            if (node instanceof Faust.AnnotationNode) {
                var xmlId = node.data()["xml:id"];
                if (xmlId) {
                    layoutState.idMap[xmlId] = vc;
                    vc.xmlId = xmlId;
                }

                // call 'start' callback before the addition of children, but after adding to the layout tree

                if (node.name().localName in Faust.TranscriptConfiguration.names) {
                    var nameHandler = Faust.TranscriptConfiguration.names[node.name().localName];
                    if (nameHandler.start) {
                        nameHandler.start(vc, node, text, layoutState);
                    }
                }
            }

            // construct children
            var that = this;
            node.children().forEach(function (c) {
                that.buildVC(parent, c, text, layoutState);
            });

            if (node instanceof Faust.AnnotationNode) {

                // space at the beginning of each line, to give empty lines height
                if (node.name().localName == "line") {
                    var emptyProp = new FaustTranscript.Text("\u00a0", {noBackground: true});
                    emptyProp.classes.push('noBackground');
                    vc.add(emptyProp);
                }

                // 'end' callback after all children are constructed
                // with the vc for 'this'

                if (node.name().localName in Faust.TranscriptConfiguration.names) {
                    var nameHandler = Faust.TranscriptConfiguration.names[node.name().localName];
                    if (nameHandler.end) {
                        nameHandler.end(vc, node, text, layoutState);
                    }
                }
            }
            return vc;
        },

        transcriptVC: function (jsonRepresentation) {

            var structuralNames = Object.keys(Faust.TranscriptConfiguration.names)
                .filter(function (name) {
                    return 'vc' in Faust.TranscriptConfiguration.names[name]
                });

            var text = Faust.Text.create(jsonRepresentation);

            var tree = new Faust.AdhocTree(text, structuralNames,
                Faust.XMLNodeUtils.documentOrderSort,
                Faust.XMLNodeUtils.isDescendant
            );

            var surfaceVC = new FaustTranscript.Surface();


            var layoutState = {
                rootVC: surfaceVC
            };

            Faust.TranscriptConfiguration.initialize(layoutState);
            this.buildVC(surfaceVC, tree, text, layoutState);

            this.postBuildDeferred.forEach(function (f) {
                f.apply(this);
            });

            return surfaceVC;
        }
    });

    FaustTranscript.TranscriptAdhocTree = TranscriptAdhocTree;

})(FaustTranscript);
