// -*- indent-tabs-mode: t; tab-width: 4 -*-


this.getWindowUtils = function(aWindow) {
	return aWindow.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
			.getInterface(Components.interfaces.nsIDOMWindowUtils);
};


this.fireMouseEvent = function(aWindow, aOptions) {
	if (!aOptions) aOptions = {};

	var x = ('x' in aOptions ? aOptions.x : 0);
	var y = ('y' in aOptions ? aOptions.y : 0);

	var box = aWindow.document.getBoxObjectFor(aWindow.document.documentElement);
	var screenX = ('screenX' in aOptions) ?
			aOptions.screenX :
			box.screenX + x + aWindow.scrollX;
	var screenY = ('screenY' in aOptions) ?
			aOptions.screenY :
			box.screenY + y + aWindow.scrollY;

	var win = this.getWindowFromScreenPoint(aWindow, screenX, screenY);

	var utils = this.getWindowUtils(win);
	if ('sendMouseEvent' in utils) {
		const nsIDOMNSEvent = Components.interfaces.nsIDOMNSEvent;
		var flags = 0;
		if (aOptions.ctrlKey) flags |= nsIDOMNSEvent.CONTROL_MASK;
		if (aOptions.altKey) flags |= nsIDOMNSEvent.ALT_MASK;
		if (aOptions.shiftKey) flags |= nsIDOMNSEvent.SHIFT_MASK;
		if (aOptions.metaKey) flags |= nsIDOMNSEvent.META_MASK;

		var button = (aOptions.button || 0);
		var detail = (aOptions.detail || 1);
		if (aOption.type == 'click' && detail == 2) aOption.type = 'dblclick';
		switch (aOptions.type)
		{
			case 'mousedown':
				utils.sendMouseEvent('mousedown', x, y, button, 1, flags);
				break;
			case 'mouseup':
				utils.sendMouseEvent('mouseup', x, y, button, 1, flags);
				break;
			case 'dblclick':
				utils.sendMouseEvent('mousedown', x, y, button, 1, flags);
				utils.sendMouseEvent('mouseup', x, y, button, 1, flags);
			case 'click':
				utils.sendMouseEvent('mousedown', x, y, button, 1, flags);
				utils.sendMouseEvent('mouseup', x, y, button, 1, flags);
				break;
		}
		return;
	}

	var node = this.getElementFromScreenPoint(aWindow, screenX, screenY);
	if (node)
		this.fireMouseEventOnElement(node, aOptions);
	else
		throw '<fireMouseEvent> No element at the specified point ('+x+','+y+') !';
};

this.fireMouseEventOnElement = function(aElement, aOptions) {
	var event = this.createMouseEventOnElement(aElement, aOptions);
	if (event && aElement)
		aElement.dispatchEvent(event);
};

this.createMouseEventOnElement = function(aElement, aOptions) {
	if (!aOptions) aOptions = {};
	var node = aElement;
	if (!node) return null;

	var doc = this.getDocumentFromEventTarget(node);
	var box = doc.getBoxObjectFor(node);
	if (!('screenX' in aOptions)) aOptions.screenX = box.screenX + parseInt(box.width / 2);
	if (!('screenY' in aOptions)) aOptions.screenY = box.screenY + parseInt(box.height / 2);

	var root = doc.documentElement;
	box = doc.getBoxObjectFor(root);
	if (!('x' in aOptions)) aOptions.x = aOptions.screenX - box.screenX - doc.defaultView.scrollX;
	if (!('y' in aOptions)) aOptions.y = aOptions.screenY - box.screenY - doc.defaultView.scrollY;

	var event = this.getDocumentFromEventTarget(node).createEvent('MouseEvents');
	event.initMouseEvent(
		(aOptions.type || 'click'),
		('canBubble' in aOptions ? aOptions.canBubble : true ),
		('cancelable' in aOptions ? aOptions.cancelable : true ),
		doc.defaultView,
		('detail' in aOptions ? aOptions.detail : 1),
		aOptions.screenX,
		aOptions.screenY,
		aOptions.x,
		aOptions.y,
		('ctrlKey' in aOptions ? aOptions.ctrlKey : false ),
		('altKey' in aOptions ? aOptions.altKey : false ),
		('shiftKey' in aOptions ? aOptions.shiftKey : false ),
		('metaKey' in aOptions ? aOptions.metaKey : false ),
		('button' in aOptions ? aOptions.button : 0 ),
		null
	);
	return event;
};


this.fireKeyEventOnElement = function(aElement, aOptions) {
	var doc = this.getDocumentFromEventTarget(aElement);

	var utils = this.getWindowUtils(doc.defaultView);
	if ('sendKeyEvent' in utils) {
		const nsIDOMNSEvent = Components.interfaces.nsIDOMNSEvent;
		var flags = 0;
		if (aOptions.ctrlKey) flags |= nsIDOMNSEvent.CONTROL_MASK;
		if (aOptions.altKey) flags |= nsIDOMNSEvent.ALT_MASK;
		if (aOptions.shiftKey) flags |= nsIDOMNSEvent.SHIFT_MASK;
		if (aOptions.metaKey) flags |= nsIDOMNSEvent.META_MASK;

		var keyCode = ('keyCode' in aOptions ? aOptions.keyCode : 0 );
		var charCode = ('charCode' in aOptions ? aOptions.charCode : 0 );
		switch (aOptions.type)
		{
			case 'keydown':
				utils.sendKeyEvent('keydown', keyCode, charCode, flags);
				break;
			case 'keyup':
				utils.sendKeyEvent('keyup', keyCode, charCode, flags);
				break;
			case 'keypress':
				utils.sendKeyEvent('keydown', keyCode, charCode, flags);
				utils.sendKeyEvent('keyup', keyCode, charCode, flags);
				break;
		}
		return;
	}

	var event = this.createKeyEventOnElement(aElement, aOptions);
	if (event && aElement)
		aElement.dispatchEvent(event);
};

this.createKeyEventOnElement = function(aElement, aOptions) {
	if (!aOptions) aOptions = {};
	var node = aElement;
	if (!node) return null;

	var doc = this.getDocumentFromEventTarget(node);

	var event = doc.createEvent('KeyEvents');
	event.initKeyEvent(
		(aOptions.type || 'keypress'),
		('canBubble' in aOptions ? aOptions.canBubble : true ),
		('cancelable' in aOptions ? aOptions.cancelable : true ),
		doc.defaultView,
		('ctrlKey' in aOptions ? aOptions.ctrlKey : false ),
		('altKey' in aOptions ? aOptions.altKey : false ),
		('shiftKey' in aOptions ? aOptions.shiftKey : false ),
		('metaKey' in aOptions ? aOptions.metaKey : false ),
		('keyCode' in aOptions ? aOptions.keyCode : 0 ),
		('charCode' in aOptions ? aOptions.charCode : 0 )
	);
	return event;
};


this.fireXULCommandEvent = function(aWindow, aOptions) {
	if (!aOptions) aOptions = {};
	var node = this.getElementFromScreenPoint(
				aWindow,
				('x' in aOptions ? aOptions.x : 0),
				('y' in aOptions ? aOptions.y : 0)
			);
	if (node)
		this.fireXULCommandEventOnElement(node, aOptions);
};

this.fireXULCommandEventOnElement = function(aElement, aOptions) {
	var event = this.createMouseEventOnElement(aElement, aOptions);
	if (event && aElement)
		aElement.dispatchEvent(this.createXULCommandEvent(event));
};

this.createXULCommandEvent = function(aSourceEvent) {
	var event = aSourceEvent.view.document.createEvent('XULCommandEvents');
	event.initCommandEvent('command',
		true,
		true,
		aSourceEvent.view,
		0,
		false,
		false,
		false,
		false,
		aSourceEvent
	);
	return event;
};


this.inputTextToField = function(aElement, aValue) {
	aElement.value = aValue || '';

	var doc = this.getDocumentFromEventTarget(aElement);
	var event = doc.createEvent('UIEvents');
	event.initUIEvent('input', true, true, doc.defaultView, 0);
	aElement.dispatchEvent(event);
	return event;
};


this.getDocumentFromEventTarget = function(aNode) {
	return aNode.document || aNode.ownerDocument || aNode;
};



// 座標から要素ノードを取得する
this.getElementFromScreenPoint = function(aWindow, aScreenX, aScreenY)
{
	var clientPos = this.getClientPointFromScreenPoint(aWindow, aScreenX, aScreenY);
	if ('elementFromPoint' in aWindow.document) {
		var elem = aWindow.document.elementFromPoint(clientPos.x, clientPos.y);
		if (/^(i?frame|browser|tabbrowser)$/.test(elem.localName)) {
			return this.getElementFromScreenPoint(
					elem.contentWindow,
					aScreenX + aWindow.scrollX,
					aScreenY + aWindow.scrollY
				);
		}
		return elem;
	}

	aWindow = this.getWindowFromScreenPoint(aWindow, aScreenX, aScreenY);

	var accNode;
	try {
		var accService = Components.classes['@mozilla.org/accessibilityService;1']
							.getService(Components.interfaces.nsIAccessibilityService);
		var acc = accService.getAccessibleFor(aWindow.document);
		accNode = acc.getChildAtPoint(clientPos.x, clientPos.y);
		accNode = accNode.QueryInterface(Components.interfaces.nsIAccessNode).DOMNode;
	}
	catch(e) {
	}

	var doc = aWindow.document;
	var startNode = accNode || doc;
	var filter = function(aNode) {
		return NodeFilter.FILTER_ACCEPT;
	};
	var nodes = [];
	var walker = aWindow.document.createTreeWalker(startNode, NodeFilter.SHOW_ELEMENT, filter, false);
	for (var node = walker.firstChild(); node != null; node = walker.nextNode())
	{
		var box = doc.getBoxObjectFor(node);
		var l = box.screenX;
		var t = box.screenY;
		var r = l + box.width;
		var b = t + box.height;
		if (l <= aScreenX && aScreenX <= r && t <= aScreenY && aScreenY <= b)
			nodes.push(node);
	}

	if (!nodes.length) return null;
	if (nodes.length == 1) return nodes[0];

	var smallest = [];
	nodes.forEach(function(aNode) {
		if (!smallest.length) {
			smallest.push(aNode);
			return
		}
		var box = doc.getBoxObjectFor(aNode);
		var size = box.width * box.height;
		var smallestBox = doc.getBoxObjectFor(smallest[0]);
		var smallestSize = smallestBox.width * smallestBox.height;
		if (size == smallestSize) {
			smallest.push(aNode);
		}
		else if (size < smallestSize) {
			smallest = [aNode];
		}
	});
	if (smallest.length == 1) return smallest[0];

	var deepest = [];
	var deepestNest = 0;
	nodes.forEach(function(aNode) {
		var nest = 0;
		var node = aNode;
		for (; node.parentNode; nest++) { node = node.parentNode; }
		if (!deepest.length) {
			deepest.push(aNode);
			deepestNest = nest;
			return
		}
		if (nest == deepestNest) {
			deepest.push(aNode);
		}
		else if (nest > deepestNest) {
			deepest = [aNode];
			deepestNest = nest;
		}
	});
	if (deepest.length == 1) return deepest[0];

	return deepest[deepest.length-1];
};

this.getClientPointFromScreenPoint = function(aWindow, aScreenX, aScreenY)
{
	var box = aWindow.document.getBoxObjectFor(aWindow.document.documentElement);
	return {
		x : aScreenX - box.screenX - aWindow.scrollX,
		y : aScreenY - box.screenY - aWindow.scrollY
	};
}

this.getWindowFromScreenPoint = function(aWindow, aScreenX, aScreenY)
{
	if ('elementFromPoint' in aWindow.document) {
		var elem = this.getElementFromScreenPoint(aWindow, aScreenX, aScreenY);
		return elem ? elem.ownerDocument.defaultView : null ;
	}

	var wins = this.flattenWindows(aWindow);
	for (var i = wins.length - 1; i >= 0; i--) {
		var win = wins[i];
		var frameList = [];
		var arr = win.document.getElementsByTagName('frame');
		for (var j = 0; j < arr.length; j++)
			frameList.push(arr[j]);
		var arr = win.document.getElementsByTagName('iframe');
		for (var j = 0; j < arr.length; j++)
			frameList.push(arr[j]);
		var arr = win.document.getElementsByTagName('tabbrowser');
		for (var j = 0; j < arr.length; j++)
			frameList.push(arr[j]);
		var arr = win.document.getElementsByTagName('browser');
		for (var j = 0; j < arr.length; j++)
			frameList.push(arr[j]);
		for (var j = frameList.length - 1; j >= 0; j--) {
			var box = win.document.getBoxObjectFor(frameList[j]);
			var l = box.screenX;
			var t = box.screenY;
			var r = l + box.width;
			var b = t + box.height;
			if (l <= aScreenX && aScreenX <= r && t <= aScreenY && aScreenY <= b)
				return frameList[j].contentWindow;
		}
		if (l <= aScreenX && aScreenX <= r && t <= aScreenY && aScreenY <= b)
			return frameList[j].contentWindow;
	}
	return null;
};

this.flattenWindows = function(aWindow) 
{
	var ret = [aWindow];
	for (var i = 0; i < aWindow.frames.length; i++)
		ret = ret.concat(this.flattenWindows(aWindow.frames[i]));
	return ret;
};
