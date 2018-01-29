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
 * @file General utility functions. 
 */

if (window.Faust === undefined) {
    window.Faust = {};
}
(function (Faust) {

    /**
     * Encode UTF-8 characters in a URI
     * @param {string} path
     * @returns {string}
     */
    Faust.encodePath = function (path) {
        var encoded = "";
        var pathComponents = path.split("/");
        for (var pc = 0; pc < pathComponents.length; pc++)
            encoded += (encoded.length == 0 ? "" : "/") + encodeURI(pathComponents[pc]);
        return encoded;
    };

    /**
     * Represents a Faust URI with the scheme "faust://"
     * @param uri
     * @constructor
     */

    Faust.URI = function (uri) {
        this.components = uri.match(/^faust:\/\/([^\/]+)\/(.*)/);
    };

    Faust.URI.prototype = {
        encodedPath: function () {
            return Faust.encodePath(this.components[2]);
        }
    };

    Faust.io = function (uri, callback, reviver) {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", uri, true);
        xhr.setRequestHeader("Accept", "application/json");
        if (callback) {
            xhr.onreadystatechange = function () {
                if (this.readyState === 4) {
                    callback(JSON.parse(xhr.responseText, reviver));
                }
            };
        }
        xhr.send(null);
    };

    Faust.xml = function (uri, callback) {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", uri, true);
        if (callback) {
            xhr.onreadystatechange = function () {
                if (this.readyState === 4) {
                    callback(xhr.responseXML);
                }
            };
        }
        xhr.send(null);
    };
})(Faust);
