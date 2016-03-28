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

  var Iterator = function (tree) {
      this._tree = tree;
      this._cursor = null;
  };
  Y.extend(Iterator, Object, {
      data: function () {
          return this._cursor;
      },
      // if null-iterator, returns first node
      // otherwise, returns next node
      next: function () {
          if (this._cursor === null) {
              var root = this._tree._root;
              if (root !== null) {
                  this._minNode(root);
              }
          } else {
              if (this._cursor.right === null) {
                  // no greater node in subtree, go up to parent
                  // if coming from a right child, continue up the stack
                  var save;
                  do {
                      save = this._cursor;
                      this._cursor = this._cursor.parent;
                      if (this._cursor === null) {
                          break;
                      }
                  } while (this._cursor.right === save);
              } else {
                  // get the next node from the subtree
                  this._minNode(this._cursor.right);
              }
          }
          return this._cursor;
      },
      // if null-iterator, returns last node
      // otherwise, returns previous node
      prev: function () {
          if (this._cursor === null) {
              var root = this._tree._root;
              if (root !== null) {
                  this._maxNode(root);
              }
          }
          else {
              if (this._cursor.left === null) {
                  var save;
                  do {
                      save = this._cursor;
                      this._cursor = this._cursor.parent;
                      if (this._cursor === null) {
                          break;
                      }
                  } while (this._cursor.left === save);
              } else {
                  this._maxNode(this._cursor.left);
              }
          }
          return this._cursor;
      },
      _minNode: function (start) {
          while (start.left !== null) {
              start = start.left;
          }
          this._cursor = start;
      },
      _maxNode: function (start) {
          while (start.right !== null) {
              start = start.right;
          }
          this._cursor = start;
      }
  });

  var TreeBase = function () {
  };
  Y.extend(TreeBase, Object, {
      // removes all nodes from the tree
      clear: function () {
          this._root = null;
          this.size = 0;
      },
      // returns node if found, null otherwise
      find: function (key) {
          var res = this._root;

          while (res !== null) {
              var c = this._comparator(key, res.key);
              if (c === 0) {
                  return res;
              } else {
                  res = res.get_child(c > 0);
              }
          }

          return null;
      },
      // returns null if tree is empty
      min: function () {
          var res = this._root;
          if (res === null) {
              return null;
          }

          while (res.left !== null) {
              res = res.left;
          }

          return res;
      },
      // returns null if tree is empty
      max: function () {
          var res = this._root;
          if (res === null) {
              return null;
          }

          while (res.right !== null) {
              res = res.right;
          }

          return res;
      },
      // returns a null iterator, call next() or prev() to point to an element
      iterator: function () {
          return new Iterator(this);
      },
      // calls cb on each node, in order
      each: function (cb) {
          var it = this.iterator(), node;
          while ((node = it.next()) !== null) {
              cb(node);
          }
      },
      // calls cb on each node, in reverse order
      reach: function (cb) {
          var it = this.iterator(), node;
          while ((node = it.prev()) !== null) {
              cb(node);
          }
      }
  });

  var Node = function (key) {
      this.key = key;
      this.values = [];
      this.parent = null;
      this.left = null;
      this.right = null;
      this.red = true;
  };
  Y.extend(Node, Object, {
      get_child: function (dir) {
          return dir ? this.right : this.left;
      },
      set_child: function (dir, val) {
          if (dir) {
              this.right = val;
          } else {
              this.left = val;
          }
          if (val !== null) {
              val.parent = this;
          }
      }
  });

  function is_red(node) {
      return node !== null && node.red;
  }

  function single_rotate(root, dir) {
      var save = root.get_child(!dir);

      root.set_child(!dir, save.get_child(dir));
      save.set_child(dir, root);

      root.red = true;
      save.red = false;

      return save;
  }

  function double_rotate(root, dir) {
      root.set_child(!dir, single_rotate(root.get_child(!dir), !dir));
      return single_rotate(root, dir);
  }

  var RBTree = function (comparator, keyFunction) {
      this._root = null;
      this._comparator = comparator;
      this._keyFunction = keyFunction || function(d) { return d; };
      this.size = 0;
  };
  Y.extend(RBTree, TreeBase, {
      // returns true if inserted, false if duplicate
      insert: function (data) {
          var key = this._keyFunction(data);
          var ret = false;

          if (this._root === null) {
              // empty tree
              this._root = new Node(key);
              this._root.values.push(data);
              ret = true;
              this.size++;
          } else {
              var head = new Node(undefined); // fake tree root

              var dir = 0;
              var last = 0;

              // setup
              var gp = null; // grandparent
              var ggp = head; // grand-grand-parent
              var p = null; // parent
              var node = this._root;
              ggp.right = this._root;

              // search down
              while (true) {
                  if (node === null) {
                      // insert new node at the bottom
                      node = new Node(key);
                      p.set_child(dir, node);
                      ret = true;
                      this.size++;
                  } else if (is_red(node.left) && is_red(node.right)) {
                      // color flip
                      node.red = true;
                      node.left.red = false;
                      node.right.red = false;
                  }

                  // fix red violation
                  if (is_red(node) && is_red(p)) {
                      var dir2 = ggp.right === gp;

                      if (node === p.get_child(last)) {
                          ggp.set_child(dir2, single_rotate(gp, !last));
                      }
                      else {
                          ggp.set_child(dir2, double_rotate(gp, !last));
                      }
                  }

                  var cmp = this._comparator(node.key, key);

                  // stop if found
                  if (cmp === 0) {
                      node.values.push(data);
                      break;
                  }

                  last = dir;
                  dir = cmp < 0;

                  // update helpers
                  if (gp !== null) {
                      ggp = gp;
                  }
                  gp = p;
                  p = node;
                  node = node.get_child(dir);
              }

              // update root
              this._root = head.right;
          }

          // make root black
          this._root.red = false;

          return ret;
      },
      // returns true if removed, false if not found
      remove: function (data) {
          if (this._root === null) {
              return false;
          }

          var key = this._keyFunction(data);
          var head = new Node(undefined); // fake tree root
          var node = head;
          node.right = this._root;
          var p = null; // parent
          var gp = null; // grand parent
          var found = null; // found item
          var dir = 1;

          while (node.get_child(dir) !== null) {
              var last = dir;

              // update helpers
              gp = p;
              p = node;
              node = node.get_child(dir);

              var cmp = this._comparator(key, node.key);

              dir = cmp > 0;

              // save found node
              if (cmp === 0) {
                  var valIndex = node.values.indexOf(data), valFound = (valIndex >= 0);
                  if (valFound) {
                      node.values.splice(valIndex, 1);
                  }
                  if (node.values.length > 0) {
                      return valFound;
                  }
                  found = node;
              }

              // push the red node down
              if (!is_red(node) && !is_red(node.get_child(dir))) {
                  if (is_red(node.get_child(!dir))) {
                      var sr = single_rotate(node, dir);
                      p.set_child(last, sr);
                      p = sr;
                  } else if (!is_red(node.get_child(!dir))) {
                      var sibling = p.get_child(!last);
                      if (sibling !== null) {
                          if (!is_red(sibling.get_child(!last)) && !is_red(sibling.get_child(last))) {
                              // color flip
                              p.red = false;
                              sibling.red = true;
                              node.red = true;
                          } else {
                              var dir2 = gp.right === p;

                              if (is_red(sibling.get_child(last))) {
                                  gp.set_child(dir2, double_rotate(p, last));
                              } else if (is_red(sibling.get_child(!last))) {
                                  gp.set_child(dir2, single_rotate(p, last));
                              }

                              // ensure correct coloring
                              var gpc = gp.get_child(dir2);
                              gpc.red = true;
                              node.red = true;
                              gpc.left.red = false;
                              gpc.right.red = false;
                          }
                      }
                  }
              }
          }

          // replace and remove if found
          if (found !== null) {
              p.set_child(p.right === node, node.get_child(node.left === null));
              this.size--;
          }

          // update root and make it black
          this._root = head.right;
          if (this._root !== null) {
              this._root.red = false;
          }

          return found !== null;
      }
  });

  Faust.RBTree = RBTree;

})(Faust);
