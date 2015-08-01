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

(function(Faust) {

	var Range = function (start, end) {
		this.start = start;
		this.end = end;
	};
	var Name = function (namespace, localName) {
		this.namespace = namespace;
		this.localName = localName;
	};
	var Text = function (id, type, contentLength, range, content) {
		this.id = id;
		this.type = type;
		this.contentLength = contentLength;
		this.range = range || new Range(0, contentLength);
		this.content = content || "";
	};
	var TextTarget = function (text, range) {
		this.text = text;
		this.range = range;
	};

	var UNKNOWN_NAME = new Name(null, "");
	var Annotation = function (name, data, targets, id) {
		this.name = name || UNKNOWN_NAME;
		this.data = data || {};
		this.targets = targets || [];
		this.id = (id !== undefined) ? id : NaN;
	};
	Y.extend(Annotation, Object, {
		target: function () {
			return (this.targets ? this.targets[0] : null);
		},
		targetIn: function (text) {
			return Y.Array.find(this.targets, function (t) {
				return (t.text === text);
			});
		}
	});

	Y.extend(TextTarget, Object, {
		textContent: function () {
			return this.range.of(this.text.content);
		}
	});
	

	Y.extend(Text, Object, {
		partition: function (annotations, start, end) {
			var partitioningAnnotations = annotations ? annotations : this.annotations;
			var partitionsStart = start ? start : 0;
			var partitionsEnd = end ? end : this.content.length;
			var offsets = [partitionsStart, partitionsEnd];

			partitioningAnnotations.forEach(function (a) {
				a.targets.forEach(function (t) {
					if (t.text == this) {
						var range = t.range;
						if(range.start > partitionsStart && range.start < partitionsEnd) {
							offsets.push(range.start);
            }
						if(range.end > partitionsStart && range.end < partitionsEnd) {
							offsets.push(range.end);
            }
					}
				}, this);
			}, this);

			offsets = Y.Array.dedupe(offsets);
			offsets.sort(function (a, b) {
				return a - b;
			});

			//if (offsets.length == 0 || offsets[0] > this.range.start) offsets.unshift(this.range.start);
			//if (offsets.length == 1 || offsets[offsets.length - 1] < this.range.end) offsets.push(this.range.end);

			var partitions = [];
			var rangeStart = -1;
			offsets.forEach(function (rangeEnd) {
				if (rangeStart >= 0) {
          partitions.push(new Range(rangeStart, rangeEnd));
        }
				rangeStart = rangeEnd;
			});

			
			return partitions;
		},

		/**
		 * Find all annotations applying (partly) to [start, end] optionally filtered by filter.
		 * @param start Integer
		 * @param end Integer
		 * @param filter Annotation filter.
		 *               If String, this is matched against the annotations local name,
		 *               if [String], this must contain the annotations local name,
		 *               if function(Annotation) this is used as predicate.
		 */
		find: function (start, end, filter) {
			var result = [],
				nameFilter = null,
				range =	 new Range(
					((typeof start === 'number' && isFinite(start)) ? start : 0),
					((typeof end === 'number' && isFinite(end)) ? end : this.contentLength)
				);

			if (typeof filter === 'function') {
				nameFilter = filter;
			} else if (Array.isArray(filter)) {
				nameFilter = function (a) {
					return (filter.indexOf(a.name.localName) >= 0);
				};
			} else if (typeof filter === 'string') {
				nameFilter = function (a) {
					return filter == a.name.localName;
				};
			} else {
				nameFilter = function () {
					return true;
				};
			}

			this._searchRange(this.rangeIndex._root, range, nameFilter, result);
			return result;
		},
		_searchRange: function (node, range, annotationFilter, result) {
			// Don't search nodes that don't exist
			if (node === null) {
				return;
			}

			// If range is to the right of the rightmost point of any interval
			// in this node and all children, there won't be any matches.
			if (range.start > node.maxEnd) {
				return;
			}

			// Search left children
			if (node.left !== null) {
				this._searchRange(node.left, range, annotationFilter, result);
			}

			// Check this node
			if (node.key.overlapsWith(range) || range.includes(node.key)) {
				node.values.filter(annotationFilter).forEach(function (v) {
					result.push(v);
				});
			}

			// If range is to the left of the start of this interval,
			// then it can't be in any child to the right.
			if (range.end < node.key.start) {
				return;
			}

			// Otherwise, search right children
			if (node.right !== null) {
				this._searchRange(node.right, range, annotationFilter, result);
			}
		},
		_setupRangeIndexNode: function (node) {
			if (node === null) {
				return 0;
			} else {
				node.maxEnd = Math.max(node.key.end, this._setupRangeIndexNode(node.left), this._setupRangeIndexNode(node.right));
				return node.maxEnd;
			}
		}
	}, {
		create: function (data) {
			var text = new Text(data.text.id, data.text.t, data.text.l, data.textRange, data.textContent), names = {};
      Object.keys(data.names).forEach(function(name) {
        names[name] = new Name(data.names[name][0], data.names[name][1]);
      });
			text.rangeIndex = new Faust.RBTree(Range.sort, function (a) {
				return a.targetIn(text).range;
			});
			text.localNameIndex = {};
			text.annotations = data.annotations.map(function (a) {
				var annotation = new Annotation(names[a.n], a.d, a.t.map(function (target) {
					return new TextTarget((target[2] == text.id ? text : target[2]), new Range(target[0], target[1]));
				}), a.id);

				text.rangeIndex.insert(annotation);

				var ln = annotation.name.localName;
				text.localNameIndex[ln] = (text.localNameIndex[ln] || []).concat(annotation);

				return annotation;
			});
			text._setupRangeIndexNode(text.rangeIndex._root);

			return text;
		}
	});
	Y.extend(Name, Object, {
		toString: function () {
			return (this.namespace == null ? "" : "{" + this.namespace + "}") + this.localName;
		},
		fromString: function (str) {
			var firstBrace = str.indexOf("{");
			if (firstBrace < 0) {
				return new NS.Name(null, str);
			}
			var secondBrace = str.indexOf("}");
			if (secondBrace < firstBrace || secondBrace >= (str.length - 1)) {
				//Y.error("Invalid Name", str, { throwFail: true });
			}

			return new NS.Name(str.substring(firstBrace + 1, secondBrace), str.substring(secondBrace + 1))
		}
	});
	Y.extend(Range, Object, {
		length: function () {
			return (this.end - this.start);
		},
		precedes: function (other) {
			return (this.end <= other.start);
		},
		overlapsWith: function (other) {
			return ((this.start < other.end) && (this.end > other.start));
		},
		includes: function (other) {
			return (this.start <= other.start && this.end >= other.end);
		},
		of: function (text) {
			return text.substring(this.start, this.end);
		},
		equalsStartOf: function (other) {
			return	(this.start == other.start) && (this.end == other.start);
		},
		amountOfOverlapWith: function (other) {
			return (Math.min(this.end, other.end) - Math.max(this.start, other.start));
		},
		fromId: function (str) {
			var components = str.replace("r", "").split("-");
			return new Range(parseInt(components[0]), parseInt(components[1]));
		},
		toId: function () {
			return "r" + this.start.toString() + "-" + this.end.toString();
		},
		toString: function () {
			return "[" + this.start + ", " + this.end + "]";
		}
	}, {
		sort: function (ra, rb) {
			return (ra.start == rb.start ? (rb.end - ra.end) : (ra.start - rb.start));
		}
	});

  Faust.Text = Text;
  Faust.Name = Name;
  Faust.Range = Range;
  Faust.TextTarget = TextTarget;
  Faust.Annotation = Annotation;

})(Faust);

