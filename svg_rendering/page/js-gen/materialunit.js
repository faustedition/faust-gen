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
	var MaterialUnit = function() {};
	MaterialUnit.prototype = {
		descendants: function() {
			return (function(list, mu) {
				for (var cc = 0; cc < mu.contents.length; cc++) {
					list.push(mu.contents[cc]);
					arguments.callee(list, mu.contents[cc]);
				}
				return list;
			})([], this);
		},
		transcription: function(callback) {
			if (this.transcript == null) { callback(); return; }
			Faust.io("goddag/" + this.transcript.source.encodedPath() + "?snapshot=true", function(data) {
				callback(new Goddag.Graph(data));
			});
		},
		
		transcriptionFromRanges: function(callback) {
			if (this.transcript == null) {
				callback(); 
				return; 
			}
			Faust.io("transcript/source/" + this.id, function(data) {
				callback(data);
			});
		}
		
	};

	var Document = function() {};
	Document.load = function(uri, callback) {
		Faust.io(uri, callback, function(key, value) {
			if (key === "order") {
        // Begin: replacement of Y.augment (which was actually only Y.mix since this has no prototype
        var from = MaterialUnit.prototype;
        for(key in from) {
          if(from.hasOwnProperty(key)) {
            if(!(key in this)) {
              this[key] = from[key];
            }
          }
        }
        // End: replacement
			}
			if (key === "source") {			
				return new Faust.URI(value);				
			}
			if (key === "facsimiles") {
				var facsimiles = [];
				for (var vc = 0; vc < value.length; vc++)
					facsimiles.push(new Faust.URI(value[vc]));
				return facsimiles;
			}
			return value;
		});
	};


  Faust.Document = Document;
  Faust.MaterialUnit = MaterialUnit;

})(Faust);
