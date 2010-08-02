// -*- indent-tabs-mode: t; tab-width: 4 -*-

const Cc = Components.classes;
const Ci = Components.interfaces;

var ns = {};
Components.utils.import('resource://uxu-modules/utils.js', ns);
Components.utils.import('resource://uxu-modules/lib/stringBundle.js', ns);
Components.utils.import('resource://uxu-modules/server/server.js', ns);
Components.utils.import('resource://uxu-modules/server/context.js', ns);
Components.utils.import('resource://uxu-modules/test/testCase.js', ns);

var utils = ns.utils;
utils.exportToDocument(document);

var bundle = ns.stringBundle.get('chrome://uxu/locale/uxu.properties');

var gServer;
var gLog;
var gAutoStart;

var gOptions = {};

const ObserverService = Cc['@mozilla.org/observer-service;1']
	.getService(Ci.nsIObserverService);

var restartObserver = { 
	observe : function(aSubect, aTopic, aData)
	{
		if (aTopic != 'quit-application-requested') return;

		if (utils.getPref('extensions.uxu.autoStart.oneTime.enabled')) {
			utils.setPref('extensions.uxu.autoStart.oneTime', true);
			utils.setPref('extensions.uxu.autoStart.oneTime.port', gServer.port);
		}
	}
};

function Startup() {
	ns.Utils.internalLoader = $('internal-loader');

	if ('arguments' in window &&
		window.arguments &&
		window.arguments.length) {
		try {
			gOptions = window.arguments[0].QueryInterface(Ci.nsIPropertyBag);
			var jsobj = {};
			jsobj.serverPort = gOptions.getProperty('serverPort');
			jsobj.hidden     = gOptions.getProperty('hidden');
			gOptions = jsobj;
		}
		catch(e) {
			gOptions = {};
		}
	}

	var context = new ns.Context(document.getElementById("content"));
	context.addRunnerListener(testRunnerlistener);

	gServer = new ns.Server(gOptions.serverPort || utils.getPref('extensions.uxu.port'));
	gServer.addListener(context);
	context.addListener(gServer);
	gServer.start();

	gLog = document.getElementById('log');
	if (!gLog.scrollBoxObject)
		gLog.scrollBoxObject = gLog.boxObject.QueryInterface(Ci.nsIScrollBoxObject);
	gAutoStart = document.getElementById('autostart');

	gAutoStart.checked = utils.getPref('extensions.uxu.auto.start');

	if (gOptions.hidden) {
		window.setTimeout(function() { window.minimize(); }, 0);
	}
	ObserverService.addObserver(restartObserver, 'quit-application-requested', false);
}

function Shutdown() {
	gServer.stop();
	ObserverService.removeObserver(restartObserver, 'quit-application-requested');

	if (ns.Utils.internalLoader == $('internal-loader'))
		ns.Utils.internalLoader = null;
}

var testRunnerlistener = {
	onStart: function() {
		this._clearLog();
		var node = document.createElement('label');
		node.setAttribute('style', 'border: 1px solid; padding: 0.5em;');
		node.setAttribute('value', 'New testcase starts');
		gLog.appendChild(node);
	},

	getReport: function(aTestCase) {
		var id = 'testcase-report-'+encodeURIComponent(aTestCase.title)+'-'+encodeURIComponent(aTestCase.source);

		var node = document.getElementById(id);
		if (node) return node;

		node = document.createElement('groupbox');
		node.setAttribute('id', id);
		node.setAttribute('class', 'server-report');
		node.appendChild(document.createElement('caption'));
		node.lastChild.setAttribute('class', 'testcase-start');
		node.lastChild.setAttribute('label', aTestCase.title);
		gLog.appendChild(node);
		return node;
	},

	onTestCaseStart: function(aEvent) {
		this.count = {
			success  : 0,
			failure  : 0,
			error    : 0,
			skip : 0
		};
		gLog.scrollBoxObject.ensureElementIsVisible(this.getReport(aEvent.data.testCase));
		document.documentElement.setAttribute('running', true);
	},

	onTestCaseFinish: function(aEvent) {
		var parent = this.getReport(aEvent.data.testCase);
		var node = document.createElement('hbox');
		node.setAttribute('class', 'testcase-finish');
		node.appendChild(document.createElement('label'));
		node.lastChild.setAttribute('value', bundle.getFormattedString(
			'all_result_statistical',
			[
				this.count.success+this.count.failure+this.count.error+this.count.skip,
				this.count.success,
				this.count.failure,
				this.count.error,
				this.count.skip
			]
		));
		parent.appendChild(node);
		gLog.scrollBoxObject.ensureElementIsVisible(node);
		document.documentElement.removeAttribute('running');
	},

	onTestCaseTestFinish: function(aEvent) {
		var report = aEvent.data.data;
		var color;
		switch (report.result)
		{
			case ns.TestCase.prototype.RESULT_SUCCESS:
				color = 'background: green; color: white; ';
				break;
			case ns.TestCase.prototype.RESULT_FAILURE:
				color = 'background: red; color: white;';
				break;
			case ns.TestCase.prototype.RESULT_ERROR:
				color = 'background: yellow; color: black;';
				break;
			case ns.TestCase.prototype.RESULT_SKIPPED:
				color = 'background: gray; color: white;';
				break;
		}
		this.count[report.result]++;
		var parent = this.getReport(aEvent.data.testCase);
		var node = document.createElement('hbox');
		node.setAttribute('class', 'test-finish');
		node.appendChild(document.createElement('label'));
		node.lastChild.setAttribute('style', color);
		node.lastChild.setAttribute('value', report.description);
		parent.appendChild(node);
		gLog.scrollBoxObject.ensureElementIsVisible(node);
	},

	_clearLog: function() {
		var range = document.createRange();
		range.selectNodeContents(gLog);
		range.deleteContents();
		range.detach();
	}
};