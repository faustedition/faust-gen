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

if(window.Faust === undefined) {
  window.Faust = {};
}
(function(Faust){
  Faust.encodePath = function (path) {
    var encoded = "";
    var pathComponents = path.split("/");
    for (var pc = 0; pc < pathComponents.length; pc++)
      encoded += (encoded.length == 0 ? "" : "/") + encodeURI(pathComponents[pc]);
    return encoded;
  };

  Faust.URI = function(uri) { 
    this.components = uri.match(/^faust:\/\/([^\/]+)\/(.*)/);
  };

  Faust.URI.prototype = {
    encodedPath: function() { return Faust.encodePath(this.components[2]); }
  };

/* REMOVE
  Faust.YUI = function() { 
    return YUI();
  };
*/

  Faust.io = function(uri, callback, reviver) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", uri, true);
    xhr.setRequestHeader("Accept", "application/json");
    if(callback) {
      xhr.onreadystatechange = function () {
        if(this.readyState === 4) {
          callback(JSON.parse(xhr.responseText, reviver));
        }
      };
    }
    xhr.send(null);
  };
  
  Faust.xml = function(uri, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", uri, true);
    if(callback) {
      xhr.onreadystatechange = function () {
        if(this.readyState === 4) {
          callback(xhr.responseXML);
        }
      };
    }
    xhr.send(null);
  };
/* REMOVE
  Faust.io = function(uri, callback, reviver) {
    Faust.YUI().use("io", "json", function(Y) {
      Y.io(Faust.contextPath + "/" + uri, {
        method: "GET",
        xdr: { responseXML: false },
        headers: { "Accept": "application/json" },
        on: { 
          success: function(id, o, a) {
            callback(Y.JSON.parse(o.responseText, reviver));
          }, 
          failure: function(id, o, a) { 
            Y.log("ERROR " + id + " " + a, "info", "Faust") }
          }
      });
    });
  };
*/
/* REMOVE
  Faust.xml = function(uri, callback) {
    Faust.YUI().use("io", function(Y) {
      Y.io(Faust.contextPath + "/" + uri, {
        method: "GET",
        on: { 
          success: function(id, o, a) {
            callback(o.responseXML);
          }, 
          failure: function(id, o, a) { 
            Y.log("ERROR " + id + " " + a, "info", "Faust") }
          }
      });
    });
  };
*/
})(Faust);
