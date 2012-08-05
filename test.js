var tree = new Arborescence(document.getElementById("output"), {
	linkType: "B",
	linkColor: "gray",
	nodeColor: function(node) {
		if(node.text.indexOf("New") == 0) {
			return ["lightgreen", "white"];
		}
		return ["lightblue", "white"];
	},
	click: function(node) {
//		tree.select
		alert(node.parent.id);
	}
}), toBeAdded = [
	{ id: 'hf', pid:'ct', text:"Hartford"},
	{ id: 'vc', pid:'cn', text:"Vancouver"},
	{ id: 'qb', pid:'cn', text:"Quebec"},
	{ id: 'on', pid:'cn', text:"Ontario"},
	{ id: 'eu',        text:"Europe"}
];


tree.add({ id: 'na',           text:"North America"});
tree.add({ id: 'us', pid:'na', text:"United States"});
tree.add({ id: 'cn', pid:'na', text:"Canada", color:"orange"});
tree.add({ id: 'mx', pid:'na', text:"Mexico"});
tree.add({ id: 'ny', pid:'us', text:"New York"});
tree.add({ id: 'nj', pid:'us', text:"New Jersey"});
tree.add({ id: 'ct', pid:'mx', text:"Connecticut", color: function(node) {
	//Change the color of Connecticut node based on whether or not it has the correct parent
	return [node.parent.text == "United States" ? "lightgreen":"red", "white"];
}});
tree.add({ id: 'kc',           text:"<img src='http://placekitten.com/50/50' /><img src='http://placekitten.com/50/50' /><br />Kitty Cat"});
//tree.add({ id: 'kc2', pid:'kc',text:"<img src='http://placekitten.com/50/50' /><img src='http://placekitten.com/50/50' /><br />Kitty Cat"});
tree.draw();

document.getElementById("options").onclick = function(e) {
	var target = e.target;
	if(e.target.name == "orientation") {
		tree.orientation = e.target.value;
		tree.draw();
	} else if(e.target.name == "justify") {
		tree.nodeJustification = e.target.value;
		tree.draw();
	}
};
document.getElementById("add").onclick = function(e) {
	tree.add(toBeAdded.pop());
	tree.draw();
	this.disabled = !toBeAdded.length;
};
document.getElementById("fix").onclick = function(e) {
	tree.moveNode('ct', 'us');
	this.parentNode.removeChild(this);
};
