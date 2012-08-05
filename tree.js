(function(){
	/* Utilities */
	function camelCase(strMatch, p1) {
		return p1.toUpperCase();
	}
	function getCSSSize(/*args*/){
		var sum = 0, style, i = arguments.length;
		if(document.defaultView && document.defaultView.getComputedStyle){
			style = document.defaultView.getComputedStyle(this, "");
			while(i-->0) {
				sum += parseInt(style.getPropertyValue(arguments[i]), 10);
			}
		}
		else if(this.currentStyle){
			while(i-->0) {
				sum += parseInt(this.currentStyle[arguments[i].replace(/\-(\w)/g, camelCase)], 10);
			}
		}
		return sum;
	}
	function isSelected(el) {
		return el.isSelected;
	}
	function Promise(count, callback) {
		var p = this;
		p.count = count;
		p.callback = callback;
		p.decrement = function() {
			if( --p.count == 0) p.callback();
		}
	}
	function measureNode(node, properties) {
		document.body.appendChild(node.div); //Attach and measure
		if (!properties.width) {
			properties.width = getCSSSize.call(node.div, "width", "border-left-width", "border-right-width", "padding-left", "padding-right");
		}
		if (!properties.height) {
			properties.height = getCSSSize.call(node.div, "height", "border-top-width", "border-bottom-width", "padding-top", "padding-bottom");
		}
		document.body.removeChild(node.div); //Remove!
	}

	/* cheap hack to find the vendor prefix.  Until that day.  'Til all are one. */
	var div = document.createElement("div"), prefixes = ["", "-webkit-", "-moz-", "-ms-", "-o-"], prefix;
	for(var i = 0; i < prefixes.length; i++) {
		div.style.background = prefixes[i] + "linear-gradient(left, red, red)";
		if(div.style.background != "") { prefix = prefixes[i]; break; }
	}

	function TreeNode(properties/*id, parent, content, width, height, color, borderColor*/, tree) {
		if(properties.id != -1) { //No div needed for the root node
			var div = this.div = document.createElement("div"); //Create the div
			div.key = properties.id;
			div.className = "arbornode";
			div.innerHTML = properties.text;
			if(properties.width != null) div.style.width = properties.width + "px";
			if(properties.height != null) div.style.height = properties.height + "px";
			if (!properties.width || !properties.height) { // See if we need to calculate the width or the height
				measureNode(this, properties); //measure
				//if images are contained in the div, we need to resize when they load
				var images = div.getElementsByTagName("img"), numImages = images.length, node = this;
				if(numImages > 0 ) {
					//TODO: attach the promise to the tree, shared by multiple nodes with images
					var p = new Promise(numImages, function() {
						measureNode(node, properties);
						node.height = properties.height;
						node.width = properties.width;
						tree.draw();
					});
					node.width = properties.width;
					node.height = properties.height;
					delete properties.width;
					delete properties.height;
					while(numImages --> 0) {
						images[numImages].onload = p.decrement;
					}
				}
			}
		}
		for(var prop in properties) {
			this[prop] = properties[prop];
		}
		this.XPosition = this.YPosition = this.prelim = this.modifier = 0;
		this.children = [];
		this.isCollapsed = this.isSelected = false;
	}

	var defaults = {
		nodeColor: "lightgreen",
		nodeBorder: "1px solid gray",
		maximumDepth : 100,
		levelSpacing : 40,
		siblingSpacing : 40,
		iSubtreeSeparation : 80,
		orientation : "top", // top, left, right, bottom
		nodeJustification : "top", // top, middle, bottom
		topXCorrection : 0,
		topYCorrection : 0,
		topXAdjustment : 0,
		topYAdjustment : 0,
		linkType : "M",
		linkColor : "blue",
		nodeSelColor : "#FFFFCC",
		selectMode : "multiple",  //none, single, multiple
		collapsible: true,
		chartHeight: -1,
		chartWidth: -1
	};
	function Arborescence(el, options) {
		var tree = this;
		for(var i in defaults) {
			this[i] = options[i] || defaults[i];
		}
		this.container = el;
		el.className += " Arborescence";
		this.canvasoffsetTop = this.canvasoffsetLeft = 0;
		this.rootYOffset = this.rootXOffset = 0;
		this.maxLevelHeight = []; this.maxLevelWidth = []; this.previousLevelNode = []; this.nDatabaseNodes = []; this.mapIDs = {};
		this.root = new TreeNode({id:-1});
		this.iSelectedNode = -1;
		this.iLastSearch = 0;
		this.root._getLeftSibling = this.root._getRightSibling = function() { return null; }
		el.onclick = function(e) {
			var target = e?e.target:event.srcElement;
			if(target.parentNode == el && target.tagName.toLowerCase() != "canvas") {
				options.click.call(tree, tree.nDatabaseNodes[tree.mapIDs[target.key]]);
			}
		}
		this.canvas = document.createElement('canvas');
		this.canvas.style.top = this.canvas.style.left = "0px";
		this.canvas.style.position = "absolute";
		if (window.G_vmlCanvasManager) { // For Internet Explorer less than version 9, have excanvas initialize the canvas method
			this.canvas = G_vmlCanvasManager.initElement(this.canvas);
		}
	}

	TreeNode.prototype = {
		constructor: TreeNode,
		_isAncestorCollapsed: function _isAncestorCollapsed() {
			return this.parent.isCollapsed ? true :
				   this.parent.id == -1   ? false :
					     this.parent._isAncestorCollapsed();
		},
		_setAncestorsExpanded: function _setAncestorsExpanded() {
			if (this.parent.id !== -1) {
				this.parent.isCollapsed = false;
				return this.parent._setAncestorsExpanded();
			}
		},
		_getChildrenCount: function _getChildrenCount() {
			return this.isCollapsed ? 0 : this.children.length;
		},
		_getLeftSibling: function _getLeftSibling() {
			var siblings = this.parent.children;
			return siblings[siblings.indexOf(this)-1];
		},
		_getRightSibling: function _getRightSibling() {
			var siblings = this.parent.children;
			return siblings[siblings.indexOf(this)+1];
		},
		_getChildrenCenter: function _getChildrenCenter(tree) {
			var first = this.children[0], last = this._getLastChild();
			return first.prelim + ((last.prelim - first.prelim) + last._getSize(tree.orientation)) / 2;
		},
		_getLastChild: function _getLastChild() {
			return this.children[this.children.length - 1];
		},
		_getSize: function _getSize(orientation) {
			return (orientation=="top" || orientation=="bottom") ? this.width:this.height;
		},
		_drawEdges: function _drawEdges(tree) {
			var x1, y1, x2, y2, x3, y3, x4, y4, node, direction, ctx = tree.canvas.getContext("2d"), count = this.children.length;
			ctx.strokeStyle = tree.linkColor;

			if(tree.orientation == "top" || tree.orientation == "left") direction = -1;
			else direction = 1;

			switch (tree.orientation) {
				case "bottom": case "top":
					x1 = this.XPosition + (this.width / 2);
					y1 = this.YPosition + (tree.orientation == "top" ? this.height : 0);
					x2 = x1;
					break;
				case "right": case "left":
					y1 = this.YPosition + (this.height / 2);
					x1 = this.XPosition + (tree.orientation == "left" ? this.width : 0);
					y2 = y1;
					break;
			}

			while (count-->0) {
				node = this.children[count];

				switch (tree.orientation) {
					case "top": case "bottom":
						x4 = x3 = node.XPosition + (node.width / 2);
						y4 = node.YPosition + (tree.orientation == "bottom" ? node.height : 0);
						switch (tree.nodeJustification) {
							case "top":
								y3 = y4 + tree.levelSpacing / 2 * direction;
								break;
							case "bottom":
								y3 = y1 - tree.levelSpacing / 2 * direction;
								break;
							case "center":
								y3 = y4 + (y1 - y4) / 2;
						}
						y2 = y3;
						break;
					case "left": case "right":
						x4 = node.XPosition + (tree.orientation == "right" ? node.width : 0);
						y4 = y3 = node.YPosition + (node.height / 2);
						switch (tree.nodeJustification) {
							case "top":
								x3 = x4 + tree.levelSpacing / 2 * direction;
								break;
							case "bottom":
								x3 = x1 - tree.levelSpacing / 2 * direction;
								break;
							case "center":
								x3 = x1 + (x4 - x1) / 2;
						}
						x2 = x3;
				}

				ctx.save();
				ctx.beginPath();
				if(tree.linkType == "M") { //Manhattan
					ctx.moveTo(x1, y1);
					ctx.lineTo(x2, y2);
					ctx.lineTo(x3, y3);
					ctx.lineTo(x4, y4);
				} else { //Bezier
					ctx.moveTo(x1, y1);
					ctx.bezierCurveTo(x2, y2, x3, y3, x4, y4);
				}					
				ctx.stroke();
				ctx.restore();
			}
		}
	};

	//Layout algorithm
	Arborescence.prototype = {
		constructor: Arborescence,
		_firstWalk: function _firstWalk(node, level) {
			var leftSibling = null, n, i, midPoint;

			node.XPosition = node.YPosition = 0;
			node.prelim = 0;
			node.modifier = 0;
			node.leftNeighbor = node.rightNeighbor = null;
			this._setLevelHeight(node, level);
			this._setLevelWidth(node, level);
			this._setNeighbors(node, level);

			if (node._getChildrenCount() == 0 || level == this.maximumDepth) {
				leftSibling = node._getLeftSibling();
				if (leftSibling != null) {
					node.prelim = leftSibling.prelim + leftSibling._getSize(this.orientation) + this.siblingSpacing;
				} else {
					node.prelim = 0;
				}
			} else {
				n = node._getChildrenCount();
				for (i = 0; i < n; i++) {
					this._firstWalk(node.children[i], level + 1);
				}

				midPoint = node._getChildrenCenter(this) - node._getSize(this.orientation) / 2;
				leftSibling = node._getLeftSibling();
				if (leftSibling != null) {
					node.prelim = leftSibling.prelim + leftSibling._getSize(this.orientation) + this.siblingSpacing;
					node.modifier = node.prelim - midPoint;
					this._apportion(node, level);
				} else {
					node.prelim = midPoint;
				}
			}
		},
		_apportion: function _apportion(node, level) {
			var firstChild = node.children[0], firstChildLeftNeighbor = firstChild.leftNeighbor, j = 1;
			for (var k = this.maximumDepth - level; firstChild != null && firstChildLeftNeighbor != null && j <= k;) {
				var modifierSumRight = 0, modifierSumLeft = 0, rightAncestor = firstChild, leftAncestor = firstChildLeftNeighbor;
				for (var l = 0; l < j; l++) {
					rightAncestor = rightAncestor.parent;
					leftAncestor = leftAncestor.parent;
					modifierSumRight += rightAncestor.modifier;
					modifierSumLeft += leftAncestor.modifier;
				}

				var totalGap = (firstChildLeftNeighbor.prelim + modifierSumLeft + firstChildLeftNeighbor._getSize(this.orientation) + 
								this.iSubtreeSeparation) - (firstChild.prelim + modifierSumRight);
				if (totalGap > 0) {
					var subtreeAux = node, numSubtrees = 0;
					for (; subtreeAux != null && subtreeAux != leftAncestor; subtreeAux = subtreeAux._getLeftSibling()) {
						numSubtrees++;
					}

					if (subtreeAux != null) {
						var subtreeMoveAux = node, singleGap = totalGap / numSubtrees;
						for (; subtreeMoveAux != leftAncestor; subtreeMoveAux = subtreeMoveAux._getLeftSibling()) {
							subtreeMoveAux.prelim += totalGap;
							subtreeMoveAux.modifier += totalGap;
							totalGap -= singleGap;
						}
					}
				}
				j++;
				if (firstChild._getChildrenCount() == 0) {
					firstChild = this._getLeftmost(node, 0, j);
				} else {
					firstChild = firstChild.children[0];
				}
				if (firstChild != null) {
					firstChildLeftNeighbor = firstChild.leftNeighbor;
				}
			}
		},
		_secondWalk: function _secondWalk(node, level, X, Y) {
			if (node && level <= this.maximumDepth) {
				var xTmp = this.rootXOffset + node.prelim + X, yTmp = this.rootYOffset + Y, 
					maxsizeTmp, nodesizeTmp, horizontal = false;

				switch (this.orientation) {
					case "top": case "bottom":
						maxsizeTmp = this.maxLevelHeight[level];
						nodesizeTmp = node.height;
						break;

					case "right": case "left":
						maxsizeTmp = this.maxLevelWidth[level];
						horizontal = true;
						nodesizeTmp = node.width;
						break;
				}
				if(this.nodeJustification == "center") {
					yTmp += (maxsizeTmp - nodesizeTmp)/2; // Half the difference between this node and the biggest in the level
				} else if( this.nodeJustification == "bottom") {
					yTmp += (maxsizeTmp - nodesizeTmp); // Offset the difference between this node and the biggest in the level
				}
				node.XPosition = horizontal? yTmp:xTmp;
				node.YPosition = horizontal? xTmp:yTmp;

				if(this.orientation == "bottom") {
					node.YPosition = -node.YPosition - nodesizeTmp;
				} else if( this.orientation == "right") {
					node.XPosition = -node.XPosition - nodesizeTmp;
				}

				if (node._getChildrenCount() != 0) {
					this._secondWalk(node.children[0], level + 1, X + node.modifier,
							Y + maxsizeTmp + this.levelSpacing);
				}
				this._secondWalk(node._getRightSibling(), level, X, Y);

				if (node.XPosition < 0) { // adjust for large tree, where "left:' offset has gone negative (off the screen)
					this.topXCorrection = Math.max(-node.XPosition, this.topXCorrection);
				}

				if (node.YPosition < 0) { // adjust for large tree, where "top:' offset has gone negative (off the screen)
					this.topYCorrection = Math.max(-node.YPosition, this.topYCorrection);
				}
			}
		},
		_positionTree: function _positionTree() {
			this.maxLevelHeight = [];
			this.maxLevelWidth = [];
			this.previousLevelNode = [];

			this._firstWalk(this.root, 0);

			switch (this.orientation) {
				case "top": case "left":
					this.rootXOffset = this.topXAdjustment + this.root.XPosition;
					this.rootYOffset = this.topYAdjustment + this.root.YPosition;
					break;
				case "bottom": case "right":
					this.rootXOffset = this.topXAdjustment + this.root.XPosition;
					this.rootYOffset = this.topYAdjustment + this.root.YPosition;
			}

			this.topXCorrection = this.topYCorrection = 0;
			this._secondWalk(this.root, 0, 0, 0);

			// Adjust for very large trees off of the screen
			if ((this.topXCorrection > 0) || (this.topYCorrection > 0)) {
				for(var i = 0; i<this.nDatabaseNodes.length; i++) {
					this.nDatabaseNodes[i].XPosition += this.topXCorrection;
					this.nDatabaseNodes[i].YPosition += this.topYCorrection;
				}
			}
		},
		_setLevelHeight: function _setLevelHeight(node, level) {
			if (this.maxLevelHeight[level] == null) {
				this.maxLevelHeight[level] = 0;
			}
			if (this.maxLevelHeight[level] < node.height) {
				this.maxLevelHeight[level] = node.height;
			}
		},
		_setLevelWidth: function _setLevelWidth(node, level) {
			if (this.maxLevelWidth[level] == null) {
				this.maxLevelWidth[level] = 0;
			}
			if (this.maxLevelWidth[level] < node.width) {
				this.maxLevelWidth[level] = node.width;
			}
		},
		_setNeighbors: function _setNeighbors(node, level) {
			node.leftNeighbor = this.previousLevelNode[level];
			if (node.leftNeighbor) {
				node.leftNeighbor.rightNeighbor = node;
			}
			this.previousLevelNode[level] = node;
		},
		_getLeftmost: function _getLeftmost(node, level, maxlevel) {
			var i, n = node._getChildrenCount(), leftmostDescendant;
			if (level >= maxlevel) { return node; }

			for (i = 0; i < n; i++) {
				leftmostDescendant = this._getLeftmost(node.children[i], level + 1, maxlevel);
				if (leftmostDescendant != null) {
					return leftmostDescendant;
				}
			}
			return null;
		},
		_selectNodeInt: function _selectNodeInt(dbindex, flagToggle) {
			if (this.selectMode == "single") {
				if ((this.iSelectedNode != dbindex) && (this.iSelectedNode != -1)) {
					this.nDatabaseNodes[this.iSelectedNode].isSelected = false;
				}
				this.iSelectedNode = (this.nDatabaseNodes[dbindex].isSelected && flagToggle) ? -1 : dbindex;
			}
			this.nDatabaseNodes[dbindex].isSelected = (flagToggle) ? !this.nDatabaseNodes[dbindex].isSelected : true;
		},
		_collapseInternal: function _collapseInternal(flag) {
			var node = null, n = 0;
			for (; n < this.nDatabaseNodes.length; n++) {
				node = this.nDatabaseNodes[n];
				node.isCollapsed = node.children.length && flag;
			}
			this.tree();
		},
		_selectInternal: function _selectInternal(flag) {
			var node = null, k = 0;
			for (; k < this.nDatabaseNodes.length; k++) {
				node = this.nDatabaseNodes[k];
				node.isSelected = flag;
			}
			this.iSelectedNode = -1;
			this.tree();
		},
		_drawNodes: function _drawNodes() {
			var fragment = document.createDocumentFragment(), node, color, border, n = this.nDatabaseNodes.length;

			while (n-->0) {
				node = this.nDatabaseNodes[n];

				if (!node._isAncestorCollapsed()) {
					color = node.isSelected ? this.nodeSelColor: node.color || this.nodeColor;
					node.div.style.top = (node.YPosition + this.canvasoffsetTop) + "px";
					node.div.style.left = (node.XPosition + this.canvasoffsetLeft) + "px";

					if (typeof color == "function") color = color(node);
					if (typeof color === "object") { //Array of 2 gradient colors
						node.div.style.background = prefix + "linear-gradient(left,"+color[0]+","+color[1]+")";
					} else { //Normal color
						node.div.style.background = color;
					}

					border = node.border || this.nodeBorder;
					node.div.style.border = border;

					if (!node.isCollapsed) {
						node._drawEdges(this);
					}
					fragment.appendChild(node.div);
				}
			}
			return fragment;
		},
		_calcWidthAndHeight: function _calcWidthAndHeight() {

			this.chartWidth = this.chartHeight = 0;

			for (var n = 0, node; n < this.nDatabaseNodes.length; n++) {
				node = this.nDatabaseNodes[n];

				if (!node._isAncestorCollapsed()) {
					this.chartWidth = Math.max(this.chartWidth, node.XPosition + node.width);
					this.chartHeight = Math.max(this.chartHeight, node.YPosition + node.height);
				}
			}
			this.chartWidth += 2;
			this.chartHeight += 2;
		},
	// Arborescence API begins here...
		draw: function draw() {
			var width, height, container = this.container;

			// Empty the tree container so we can refill it
			while (container.hasChildNodes()) container.removeChild( container.firstChild );

			this._positionTree();
			this._calcWidthAndHeight();

			width = this.divWidth ? this.divWidth : this.chartWidth;
			height = this.divHeight ? this.divHeight : this.chartHeight;

			// Set the size on the tree container
			this.container.style.width    = width  + "px";
			this.container.style.height   = height + "px";

			this.canvas.width = this.chartWidth;
			this.canvas.height = this.chartHeight;
			container.appendChild(this.canvas);

			container.appendChild(this._drawNodes());
		},
		/* 
		 * Args is a hash containing potentially:  width, height, text, color, borderColor, pid - the id of the parent's node
		 */
		add: function (args) {
			var node, count = this.nDatabaseNodes.length;
			args.parent = this.root;
			args.width = args.width || this.defaultNodeWidth; //Width, height and color defaults...
			args.height = args.height || this.defaultNodeHeight;

			while (count-->0) {
				if (this.nDatabaseNodes[count].id == args.pid) {
					args.parent = this.nDatabaseNodes[count];
					break;
				}
			}
			node = new TreeNode(args, this);  //Create the node
			this.mapIDs[node.id] = this.nDatabaseNodes.length;
			this.nDatabaseNodes.push(node);
			args.parent.children.push(node);
			args.parent.canCollapse = true; //Has children so now it can collapse
		},
		selectAll: function () { (this.selectMode != "multiple") && this._selectAllInt(true); },
		unselectAll: function () {	this._selectInternal(false); },
		collapseAll: function () { this._collapseInternal(true); },
		expandAll: function () { this._collapseInternal(false); },
		collapseNode: function (nodeid, update) {
			var dbindex = this.mapIDs[nodeid];
			this.nDatabaseNodes[dbindex].isCollapsed = !this.nDatabaseNodes[dbindex].isCollapsed;
			update && this.draw();
		},
		moveNode: function moveNode(node, newParent) {
			node = this.nDatabaseNodes[this.mapIDs[node]];
			var parent = node.parent;
			newParent = this.nDatabaseNodes[this.mapIDs[newParent]];
			parent.children.splice(parent.children.indexOf(node), 1); //remove from old parent
			newParent.children.push(node); //put in new parent
			node.parent = newParent;
			node.pid = newParent.id;
			this.draw();
		},
		/*searchNodes: function(callback)*/
		selectNode: function selectNode(nodeid) {
			this._selectNodeInt(this.mapIDs[nodeid], true);
			this.draw();
		},
		setNodeTitle: function setNodeTitle(nodeid, text, update) {
			var dbindex = this.mapIDs[nodeid];
			this.nDatabaseNodes[dbindex].text = text;
			update && this.draw();
		},
		getSelectedNodes: function getSelectedNodes() {
			return this.nDatabaseNodes.filter(isSelected);
		}
	};

	Arborescence.version = "0.9";
	window.Arborescence = Arborescence;
})();
