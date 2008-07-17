var lib_module = new ModuleManager(['chrome://uxu/content/lib']); 
var utils  = lib_module.require('package', 'utils');
var bundle = lib_module.require('package', 'bundle');

var test_module = new ModuleManager(['chrome://uxu/content/test']);
var runner_utils = test_module.require('package', 'runner_utils');

const Cc = Components.classes;
const Ci = Components.interfaces;

const ObserverService = Cc['@mozilla.org/observer-service;1']
	.getService(Ci.nsIObserverService);
 
/* UTILITIES */ 
	
function x() 
{
	var contextNode, path;
	if (arguments[0] instanceof XULElement) {
		contextNode = arguments[0];
		path = arguments[1];
	}
	else {
		path = arguments[0];
		contextNode = document;
	}

	function resolver(prefix)
	{
		switch (prefix)
		{
			case 'xul':
				return 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul';
				break;
			case 'hy':
				return 'http://hyperstruct.net/';
				break;
			default:
				return null;
		}
	}

	return document.evaluate(
		path, contextNode, resolver,
		XPathResult.ANY_UNORDERED_NODE_TYPE, null).
		singleNodeValue;
}
 
function _(idOrElement, subCriteria) 
{
	var element = (idOrElement instanceof XULElement) ?
		idOrElement : document.getElementById(idOrElement);

	if (subCriteria)
		if (typeof(subCriteria) == 'object') {
			for(var attributeName in subCriteria)
				return x(element, './/*[@' + attributeName + '=' +
						 '"' + subCriteria[attributeName] + '"]');
		} else
			return x(element, './/*[@role="' + subCriteria + '"]');
	else
		return element;
}
 
function clone(aBlueprintName) 
{
	return _('blueprints', aBlueprintName)
		.cloneNode(true);
}
 
function removeChildrenOf(aElement) 
{
	var range = document.createRange();
	range.selectNodeContents(aElement);
	range.deleteContents();
	range.detach();
}
 
function padLeft(aThing, aWidth, aPadder) 
{
	var paddedString = '';
	var string = aThing.toString();
	return (string.length < aWidth) ?
		(function() {
			for (var i = 0, l = aWidth - string.length; i < l; i++)
				paddedString += aPadder;
			return paddedString + string;
		})() :
		string;
}
 
function scrollReportsTo(aTarget) 
{
	if (!aTarget) return;
	_('testcase-reports')
		.boxObject
		.QueryInterface(Ci.nsIScrollBoxObject)
		.ensureElementIsVisible(aTarget);
};
 
function getFailureReports() 
{
	var reports = _('testcase-reports');
	return Array.prototype.slice.call(reports.getElementsByAttribute('report-type', 'failure'));
}
 
function getErrorReports() 
{
	var reports = _('testcase-reports');
	return Array.prototype.slice.call(reports.getElementsByAttribute('report-type', 'error'));
}
  
/* file picker */ 
	
function pickFile(aMode, aOptions) 
{
	if (!aOptions) aOptions = {};
	var mode = 'mode' + (aMode ?
						 aMode[0].toUpperCase() + aMode.substr(1) :
						 'open');
	const nsIFilePicker = Ci.nsIFilePicker;

	var picker = Cc["@mozilla.org/filepicker;1"]
		.createInstance(nsIFilePicker);
	if (aOptions.defaultExtension)
		picker.defaultExtension = aOptions.defaultExtension;

	if (aOptions.defaultFile) {
		var defaultFile = aOptions.defaultFile;
		try {
			defaultFile = defaultFile.QueryInterface(Ci.nsILocalFile)
		}
		catch(e) {
			defaultFile = utils.makeFileWithPath(defaultFile);
		}
		if (defaultFile) {
			if (defaultFile.exists() && defaultFile.isDirectory()) {
				picker.displayDirectory = defaultFile;
			}
			else if (!defaultFile.exists() || !defaultFile.isDirectory()) {
					picker.displayDirectory = defaultFile.parent;
			}
		}
	}

	picker.init(window, aOptions.title || '', nsIFilePicker[mode]);
	if (aOptions.filters) {
		for (var filter in aOptions.filters) {
			picker.appendFilter(filter, aOptions.filters[filter]);
		}
	}
	picker.appendFilters((aOptions.filter || 0) | nsIFilePicker.filterAll);
	var result = picker.show();
	if (result == nsIFilePicker.returnOK ||
	   result == nsIFilePicker.returnReplace)
		return picker.file;
}
 
function pickFileUrl(aMode, aOptions) 
{
	var file = pickFile(aMode, aOptions);
	if (file)
		return utils.getURLSpecFromFilePath(file.path);
}
 
const fileDNDObserver = 
{
	
	isTestCase : function(aFile) 
	{
		return aFile && (aFile.isDirectory() || /\.js$/.test(aFile.leafName));
	},
 
	onDrop : function(aEvent, aTransferData, aSession) 
	{
		var file = aTransferData.data;
		if (this.isTestCase(file)) {
			_('file').value = file.path;
			updateTestCommands();
			reset();
		}
	},
 
	canDrop : function(aEvent, aSession) 
	{
		if (_('stop').getAttribute('disabled') != 'true')
			return false;
		var XferDataSet = nsTransferable.get(
				this.getSupportedFlavours(),
				nsDragAndDrop.getDragData,
				true
			);
		var XferData = XferDataSet.first.first;
		var file = XferData.data;
		return this.isTestCase(file);
	},
 
	onDragOver : function(aEvent, aFlavour, aSession) 
	{
	},
 
	onDragExit : function(aEvent, aFlavour, aSession) 
	{
	},
 
	getSupportedFlavours : function () 
	{
		var flavours = new FlavourSet();
		flavours.appendFlavour('application/x-moz-file', 'nsIFile');
		return flavours;
	}
 
}; 
   
/* DOMAIN */ 
	
function startup() 
{
	if (!isLinux()) {
		ObserverService.addObserver(alwaysRaisedObserver, 'xul-window-registered', false);
		if (utils.getPref('extensions.uxu.mozunit.alwaysRaised'))
			toggleAlwaysRaised();
	}
	updateTestCommands();
	_('content').addEventListener('load', onContentLoad, true);
}
	 
var alwaysRaisedObserver = { 
	observe : function(aSubect, aTopic, aData)
	{
		var win = getXULWindow();
		if (aTopic == 'xul-window-registered' &&
			win.zLevel != win.normalZ) {
			win.zLevel = win.normalZ;
			window.setTimeout(function() {
				win.zLevel = win.highestZ;
			}, 250);
		}
	}
};
  
function shutdown() 
{
	if (!isLinux()) {
		ObserverService.removeObserver(alwaysRaisedObserver, 'xul-window-registered');
	}
	_('content').removeEventListener('load', onContentLoad, true);
	hideSource();
}
  
/* test cases */ 
	
function newTestCase() 
{
	var file = pickFile('save', makeTestCaseFileOptions());
	if (file) {
		reset();
		if (file.exists()) file.remove(true);
		_('file').value = file.path;
		writeTemplate(file.path);
		window.setTimeout(function() {
			openInEditor(file.path, 4, 29);
		}, 100);
	}
}
	 
function writeTemplate(aFilePath) 
{
	var data = utils.readFrom('chrome://uxu/locale/sample.test.js');
	utils.writeTo(data, aFilePath);
}
  
function openTestCase(aIsFolder) 
{
	var file = pickFile((aIsFolder ? 'getFolder' : '' ), makeTestCaseFileOptions(aIsFolder));
	if (file) {
		_('file').value = file.path;
		updateTestCommands();
		reset();
	}
}
 
function pickTestFile(aOptions) 
{
	var url = pickFileUrl(null, aOptions);
	if (url) {
		_('file').value = url;
		updateTestCommands();
		reset();
	}
}
 
function makeTestCaseFileOptions(aIsFolder) 
{
	return {
		defaultFile : _('file').value,
		defaultExtension : 'test.js',
		filters : {
			'Javascript Files' : '*.test.js'
		},
		title : bundle.getString(aIsFolder ? 'picker_title_open_testcase_folder' : 'picker_title_open_testcase' )
	};
}
 
function getFocusedPath() 
{
	var node = document.popupNode;
	if (node) {
		var file = document.evaluate(
				'ancestor-or-self::*[@role="testcase-report" or local-name()="listitem"]/@file',
				node,
				null,
				XPathResult.STRING_TYPE,
				null
			).stringValue;
		if (file && file.indexOf('file:') > -1)
			return utils.getFilePathFromURLSpec(file);
	}
	return null;
}
  
/* runner */ 
	
function TestReportHandler(aTestCase) 
{
	this.testCase = aTestCase;
	this.mFinishHandlers = [
		(function() {
			runner_utils.cleanUpModifications(this.testCase);
		})
	];
}
TestReportHandler.prototype = {
	getTestCaseReport : function(aTitle)
	{
		var id = 'testcase-report-'+encodeURIComponent(aTitle);
		return _(id) ||
			(function() {
				var wTestCaseReport = clone('testcase-report');
				wTestCaseReport.setAttribute('id', id);
				wTestCaseReport.setAttribute('title', aTitle);
				_(wTestCaseReport, 'title').textContent = aTitle;
				_(wTestCaseReport, 'bar').setAttribute('class', 'testcase-fine');
				_('testcase-reports').appendChild(wTestCaseReport);
				scrollReportsTo(wTestCaseReport);
				return wTestCaseReport;
			})();
	},
	handleReport : function(aReport) {
		var wTestCaseReport = this.getTestCaseReport(this.testCase.title);
		_(wTestCaseReport).setAttribute('test-id', aReport.testID);
		_(wTestCaseReport).setAttribute('file', aReport.namespaceURL);
		_(wTestCaseReport, 'bar').setAttribute('mode', 'determined');
		_(wTestCaseReport, 'bar').setAttribute(
			'value', parseInt(aReport.testIndex / aReport.testCount * 100));
		_(wTestCaseReport, 'total-counter').value = aReport.testCount;

		_(wTestCaseReport, 'bar').setAttribute('testcase-results',
			_(wTestCaseReport, 'bar').getAttribute('testcase-results')+
			' '+aReport.result
		);

		gTotalCount++;
		switch (aReport.result)
		{
			case 'success':
				gSuccessCount++;
				var successes = parseInt(_(wTestCaseReport, 'success-counter').value);
				_(wTestCaseReport, 'success-counter').value = successes + 1;
				return;
			case 'passover':
				gPassOverCount++;
				var passover = parseInt(_(wTestCaseReport, 'passover-counter').value);
				_(wTestCaseReport, 'passover-counter').value = passover + 1;
				return;
			case 'failure':
				gFailureCount++;
				break;
			case 'error':
				gErrorCount++;
				break;
			default:
				break;
		}

		_(wTestCaseReport, 'bar').setAttribute('class', 'testcase-problems');

		var id = 'test-report-'+encodeURIComponent(title)+'-'+_(wTestCaseReport, 'test-reports').childNodes.length;
		var wTestReport = clone('test-report');
		wTestReport.setAttribute('id', id);
		_(wTestReport, 'result').value = bundle.getString('report_result_'+aReport.result);
		_(wTestReport, 'icon').setAttribute('class', 'test-' + aReport.result);
		_(wTestReport, 'description').textContent = aReport.testDescription;
		_(wTestReport, 'description').setAttribute('tooltiptext', aReport.testDescription);
		_(wTestReport).setAttribute('report-type', aReport.result);
		if (aReport.exception) {
			var message = aReport.exception.message.replace(/^\s+/, '');
			if (aReport.result == 'failure') {
				message = message.split(/[\n\r]+<(?:EXPECTED|ACTUAL)>:/);
				if (message.length > 1) {
					_(wTestReport, 'actual-value').textContent = message.pop();
					_(wTestReport, 'expected-value').textContent = message.pop();
					_(wTestReport, 'vs').removeAttribute('hidden');
				}
				message = message.join('\n');
			}
			_(wTestReport, 'additionalInfo').textContent = message;
			if (aReport.exception.stack) {
				displayStackTrace(aReport.exception.stack, _(wTestReport, 'stack-trace'));
				_(wTestReport, 'stack-trace').hidden = false;
			}
		}

		_(wTestCaseReport, 'test-reports').appendChild(wTestReport);
		scrollReportsTo(wTestReport);
	},
	set onFinish(aValue) {
		this.mFinishHandlers.push(aValue);
		return aValue;
	},
	get onFinish() {
		var handlers = this.mFinishHandlers;
		var self = this;
		return (function() {
				handlers.forEach(function(aHandler) {
					try {
						aHandler.call(self);
					}
					catch(e) {
						dump(e+'\n');
					}
				});
			});
	}
};
 
function onAllTestsFinish() 
{
	if (!_('content').collapsed && contentAutoExpanded) {
		toggleContent();
	}

	if (shouldAbortTest) {
		_('testResultStatus').setAttribute('label', bundle.getString('all_abort'));
		return;
	}
	else if (gFailureCount || gErrorCount) {
		_('runFailed').removeAttribute('disabled');
		var failures = getFailureReports();
		var errors = getErrorReports();
		scrollReportsTo(failures.length ? failures[0] : errors[0]);
		var status = [];
		if (failures.length) status.push(bundle.getFormattedString('all_result_failure', [gFailureCount]));
		if (errors.length) status.push(bundle.getFormattedString('all_result_error', [gErrorCount]));
		_('testResultStatus').setAttribute('label', status.join(' / '));
	}
	else {
		scrollReportsTo(_('testcase-reports').firstChild);
		_('testResultStatus').setAttribute('label',
			bundle.getString(gPassOverCount ? 'all_result_done' : 'all_result_success' )
		);
	}
	_('testResultStatistical').hidden = false;
	_('testResultStatistical').setAttribute('label',
		bundle.getFormattedString(
			'all_result_statistical',
			[gTotalCount, gSuccessCount, gFailureCount, gErrorCount, gPassOverCount]
		)
	);
};
 
function onError(aError) 
{
	_('prerun-report', 'error').textContent = bundle.getFormattedString('error_failed', [aError.toString()]);
	_('prerun-report', 'error').hidden = false;

	if (aError.stack) {
		displayStackTrace(aError.stack, _('prerun-report', 'stack-trace'));
		_('prerun-report', 'stack-trace').hidden = false;
		_('prerun-report').hidden = false;
	}
}
 
var traceLineRegExp = /@(\w+:.*)?:(\d+)/;
var includeRegExp = /^chrome:\/\/uxu\/content\/test\/helper\/subScriptRunner\.js\?includeSource=([^;,]+)/i;
function displayStackTrace(aTrace, aListbox) 
{
	var fullLines = aTrace.split('\n').map(function(aLine) {
			if (!aLine.match(traceLineRegExp)) return aLine;
			var sourceUrl = RegExp.$1;
			var match = sourceUrl.match(includeRegExp);
			var includeSource = match ? match[1] : null ;
			if (includeSource) {
				 aLine = aLine.replace(sourceUrl, decodeURIComponent(includeSource));
			}
			return aLine;
		});
	var lines = fullLines.filter(function(aLine) {
			return /\w+:\/\//.test(aLine) && aLine.indexOf('@chrome://uxu/content/') < 0;
		});
	if (!lines.length || utils.getPref('extensions.uxu.mozunit.showInternalStacks'))
		lines = fullLines;
	lines.forEach(function(aLine) {
		if (!aLine) return;
		var item = document.createElement('listitem');
		item.setAttribute('label', aLine);
		item.setAttribute('crop', 'center');
		if (/@(\w+:.*)?:(\d+)/.test(aLine))
			item.setAttribute('file', RegExp.$1);
		aListbox.appendChild(item);
	});
}
 
function reset() 
{
	gTotalCount    = 0;
	gSuccessCount  = 0;
	gPassOverCount = 0;
	gErrorCount    = 0;
	gFailureCount  = 0;
	_('runFailed').setAttribute('disabled', true);
	_('prerun-report', 'error').hidden = true;
	_('prerun-report', 'stack-trace').hidden = true;
	_('testResultStatus').setAttribute('label', '');
	_('testResultStatistical').setAttribute('label', '');
	_('testResultStatistical').hidden = true;
	removeChildrenOf(_('prerun-report', 'stack-trace'));
	removeChildrenOf(_('testcase-reports'))
	hideSource();
}
var gTotalCount    = 0;
var gSuccessCount  = 0;
var gPassOverCount = 0;
var gErrorCount    = 0;
var gFailureCount  = 0;
 
function setRunningState(aRunning) 
{
	if (aRunning) {
		_('run-box').setAttribute('hidden', true);
		_('run').setAttribute('disabled', true);
		_('runPriority').setAttribute('disabled', true);
		_('runAll').setAttribute('disabled', true);
		_('runFailed').setAttribute('disabled', true);
		_('stop-box').removeAttribute('hidden');
		_('stop').removeAttribute('disabled');
		_('testRunningProgressMeter').setAttribute('mode', 'determined');
		_('testRunningProgressMeterPanel').removeAttribute('collapsed');
		_('testResultStatus').setAttribute('label', bundle.getString('all_wait'));
	}
	else {
		_('run-box').removeAttribute('hidden');
		_('run').removeAttribute('disabled');
		_('runPriority').removeAttribute('disabled');
		_('runAll').removeAttribute('disabled');
		_('runFailed').setAttribute('disabled', true);
		_('stop-box').setAttribute('hidden', true);
		_('stop').setAttribute('disabled', true);
		_('testRunningProgressMeter').setAttribute('mode', 'undetermined');
		_('testRunningProgressMeterPanel').setAttribute('collapsed', true);
	}
}
 
function run(aAll) 
{
	reset();
	var suites = loadSuites();
	var tests = initializeTests(suites);
	if (aAll) {
		tests.forEach(function(aTestCase) {
			aTestCase.masterPriority = 'must';
		});
	}
	this.runTests(tests);
}
	
function runByPref() 
{
	run(utils.getPref('extensions.uxu.mozunit.runMode') == 1 ? true : false );
}
 
function loadSuites() 
{
	var path = _('file').value;
	var file = utils.makeFileWithPath(path);

	var suites;
	if (file.isDirectory())
		suites = loadFolder(file);
	else
		suites = [loadFile(file)];

	return suites;
}
 
function runTests(aTests) 
{
	shouldAbortTest = false;
	var max = aTests.length + 1;
	var runTest = function(aTest, aIndex) {
			if (shouldAbortTest) {
				setRunningState(false);
				onAllTestsFinish();
				throw 'stop';
			}
			try {
				setRunningState(true);
				_('testRunningProgressMeter').setAttribute('value',
						parseInt(((aIndex + 1) / max) * 100));
				aTest.run(stopper);
			}
			catch(e) {
				onError(e);
			}
		};

	var stopper = function() {
			return shouldAbortTest;
		};

	if (utils.getPref('extensions.uxu.mozunit.runParallel')) {
		aTests.forEach(runTest);
	}
	else {
		var count = 0;
		var test;
		window.setTimeout(function() {
			if ((!test || test.done) && aTests.length) {
				test = aTests.shift();
				runTest(test, count++);
			}
			if (aTests.length)
				window.setTimeout(arguments.callee, 100);
		}, 100);
	}
}
var shouldAbortTest = false;
  
function runFailed() 
{
	var failedTests = {};
	[].concat(getFailureReports()).concat(getErrorReports())
		.forEach(function(aTestReport) {
			var title = aTestReport.parentNode.parentNode.getAttribute('title');
			if (title in failedTests) return;
			failedTests[title] = true;
		});
	reset();
 	var suites = loadSuites();
	var tests = initializeTests(
			suites,
			function(aTest) {
				aTest.masterPriority = 'must';
				return aTest.title in failedTests;
			}
		);
	this.runTests(tests);
}
 
function stop() 
{
	shouldAbortTest = true;
	_('stop').setAttribute('disabled', true);
}
	
function loadFolder(aFolder) 
{
	var filesMayBeTest = runner_utils.getTestFiles(aFolder);
	return filesMayBeTest.map(function(aFile) {
			return loadFile(aFile);
		});
}
 
function loadFile(aFile) 
{
	var url = utils.getURLSpecFromFilePath(aFile.path);

	try {
		var suite = runner_utils.createTestSuite(url, _('content'));
	}
	catch(e) {
		if (/\.(js|jsm)$/i.test(aFile.leafName))
			onError(e);
		suite = null;
	}

	return suite;
}
 
function initializeTests(aSuites, aFilter) 
{
	if (!aFilter)
		aFilter = function(aTest) { return true; };

	var syncTestCount = 0;
	var asyncTestCount = 0;

	var onSyncTestEnd = function() {
			syncTestCount--;
			if (!syncTestCount && !asyncTestCount) {
				setRunningState(false);
				onAllTestsFinish();
			}
		};
	var onAsyncTestEnd = function() {
			asyncTestCount--;
			if (!syncTestCount && !asyncTestCount) {
				setRunningState(false);
				onAllTestsFinish();
			}
		};

	var tests,
		allTests = [];
	aSuites.forEach(function(suite, aIndex) {
		if (!suite) return;
		try {
			tests = runner_utils.getTests(suite);
			if (!tests.length)
				throw new Error(bundle.getFormattedString('error_test_not_found', [suite.fileURL]));

			tests = tests.filter(aFilter);
			tests.forEach(function(aTestCase) {
				aTestCase.reportHandler = new TestReportHandler(aTestCase);
				if (aTestCase.runStrategy == 'async') {
					aTestCase.reportHandler.onFinish = onAsyncTestEnd;
					asyncTestCount++;
				}
				else {
					aTestCase.reportHandler.onFinish = onSyncTestEnd;
					syncTestCount++;
				}
			}, this);
			allTests = allTests.concat(tests);
		}
		catch(e) {
			onError(e);
		}
	}, this);

	return allTests;
}
  
function saveReport() 
{
}
 
function stylizeSource(aSourceDocument, aLineCallback) 
{
	var originalSource = aSourceDocument.getElementsByTagName('pre')[0];
	var processedSource = aSourceDocument.createElementNS('http://www.w3.org/1999/xhtml', 'pre');
	var sourceLines = originalSource.textContent.split('\n');
	var sourceLine, htmlLine, lineContent;
	for(var i=0, l=sourceLines.length; i<l; i++) {
		if (aLineCallback)
			htmlLine = aLineCallback(aSourceDocument, i+1, sourceLines[i]) ||
				aSourceDocument.createTextNode(sourceLines[i]);

		processedSource.appendChild(htmlLine)
	}
	processedSource.normalize();
	originalSource.parentNode.replaceChild(processedSource, originalSource);

	var cssElem = aSourceDocument.createElementNS('http://www.w3.org/1999/xhtml', 'style');
	cssElem.type = 'text/css';
	cssElem.textContent =
		'body { margin: 0; }' +
		'#current { font-weight: bold; background-color: #e5e5e5; }' +
		'.link { color: blue; border-bottom: thin solid blue; cursor: pointer; }';

	aSourceDocument.getElementsByTagName('head')[0].appendChild(cssElem);
}
 
function openInEditor(aFilePath, aLineNumber, aColumnNumber, aCommandLine) 
{
	if (utils.makeFileWithPath(aFilePath).isDirectory()) {
		return;
	}

	aLineNumber = aLineNumber || 1;
	aColumnNumber = aColumnNumber || 1;
	aCommandLine = aCommandLine ||
		utils.getPref('extensions.uxu.mozunit.editor') ||
		utils.getPref('extensions.mozlab.mozunit.editor') ||
		(utils.getPref('view_source.editor.path') ?
			'"'+utils.getPref('view_source.editor.path')+'" "%f"' : '') ||
		'/usr/bin/x-terminal-emulator -e /usr/bin/emacsclient -t +%l:%c %f';

	var tokens = [''];
	var quot   = '';
	var char;
	for (var i = 0, maxi = aCommandLine.length; i < maxi; i++)
	{
		char = aCommandLine.charAt(i);
		if (char == '"' || char == "'") {
			if (quot) {
				quot = '';
				tokens.push('');
				continue;
			}
			else {
				quot = char;
				continue;
			}
		}
		else if (/\s/.test(char)) {
			if (!quot) {
				if (tokens[tokens.length-1]) tokens.push('');
				continue;
			}
		}
		tokens[tokens.length-1] += char;
	}

	var argv = tokens.map(
		function(word) {
			return word.
				replace('%l', aLineNumber).
				replace('%c', aColumnNumber).
				replace('%u', utils.getURLSpecFromFilePath(aFilePath)).
				replace('%f', aFilePath);
		});

	var editorPath;
	var executable = Cc["@mozilla.org/file/local;1"].
		createInstance(Ci.nsILocalFile);
	var process = Cc["@mozilla.org/process/util;1"].
		createInstance(Ci.nsIProcess);
	try {
		editorPath = argv.shift();
		executable.initWithPath(editorPath);
		process.init(executable);
		process.run(false, argv, argv.length);
		return;
	}
	catch(e) {
		editorPath = '';
	}
	if (!editorPath || !executable.exists()) {
		var editor = pickFile('open', {
				title : bundle.getString('picker_title_external_editor'),
				defaultExtension : 'exe',
				filter : Ci.nsIFilePicker.filterApps
			});
		if (!editor || !editor.path) return;
		utils.setPref('extensions.uxu.mozunit.editor', '"'+editor.path+'" "%f"');
		arguments.callee(aFilePath, aLineNumber, aColumnNumber);
	}
}
  
/* UI */ 
	 
function isLinux() 
{
	return /linux/i.test(navigator.platform);
}
 
function updateRunMode() 
{
	var runPriority = _('runPriority');
	var runAll = _('runAll');
	var label;
	switch (utils.getPref('extensions.uxu.mozunit.runMode'))
	{
		default:
		case 0:
			label = runPriority.getAttribute('label-default');
			runPriority.setAttribute('label', label);
			label = runAll.getAttribute('label-normal');
			runAll.setAttribute('label', label);
			break;

		case 1:
			label = runPriority.getAttribute('label-normal');
			runPriority.setAttribute('label', label);
			label = runAll.getAttribute('label-default');
			runAll.setAttribute('label', label);
			break;
	}
}
 
function toggleAlwaysRaised() 
{
	var win = getXULWindow();
	win.zLevel = (win.zLevel == win.normalZ) ?
			win.highestZ : win.normalZ;
	utils.setPref('extensions.uxu.mozunit.alwaysRaised', win.zLevel != win.normalZ);
}
	
function getXULWindow() 
{
	return window
		.QueryInterface(Ci.nsIInterfaceRequestor)
		.getInterface(Ci.nsIWebNavigation)
		.QueryInterface(Ci.nsIDocShellTreeItem)
		.treeOwner
		.QueryInterface(Ci.nsIInterfaceRequestor)
		.getInterface(Ci.nsIXULWindow);
}
  
function toggleContent() 
{
	_('content').collapsed = !_('content').collapsed;
	_('content-splitter').hidden = !_('content-splitter').hidden;
}
	
var contentAutoExpanded = false; 
 
function onContentLoad() 
{
	if (!utils.getPref('extensions.uxu.mozunit.autoShowContent')) return;
	if (_('content').collapsed) {
		contentAutoExpanded = true;
		toggleContent();
	}
	else if (content.location.href == 'about:blank' && contentAutoExpanded) {
		contentAutoExpanded = false;
		toggleContent();
	}
}
  
function showSource(aTraceLine) 
{
	var match = aTraceLine.match(/@(\w+:.*)?:(\d+)/);
	if (!match) return;

	var sourceUrl = match[1];
	var lineNumber = match[2];
	var encoding;

	if (!sourceUrl) return;

	var frame = _('source-viewer', 'source');
	var opened = !_('source-splitter').hidden;
	_('source-splitter').hidden = false;
	_('source-viewer').collapsed = false;
	if (!opened && utils.getPref('extensions.uxu.mozunit.autoExpandWindow.sourceViewer')) {
		window.resizeBy(
			_('source-splitter').boxObject.width +
			_('source-viewer').boxObject.width,
			0
		);
	}

	match = sourceUrl.match(/[;\?]encoding=([^;,]+)/i);
	if (match && match[1]) {
		encoding = match[1];
		sourceUrl = sourceUrl.replace(/\?.+$/, '');
	}

	function onLoad(aEvent)
	{
		_('source-viewer', 'source').removeEventListener('load', onLoad, true);

		stylizeSource(
			_('source-viewer', 'source').contentDocument,
			function(aSourceDoc, aNumber, aContent)
			{
				aContent = padLeft(aNumber, 3, 0) + ' ' + aContent + '\n';

				if (aNumber == lineNumber) {
					var currentLine = aSourceDoc.createElementNS('http://www.w3.org/1999/xhtml', 'div');
					currentLine.setAttribute('id', 'current');
					currentLine.textContent = aContent;

					if (sourceUrl.match(/^file:\/\//)) {
						currentLine.setAttribute('class', 'link');
						currentLine.addEventListener('click', function(aEvent) {
							openInEditor(utils.getFilePathFromURLSpec(sourceUrl), lineNumber);
						}, false);
					}

					return currentLine;
				}
				else {
					return aSourceDoc.createTextNode(aContent);
				}
			}
		);

		_('source-viewer', 'source').contentWindow.scrollTo(
			0,
			(frame.contentDocument.getElementById('current').offsetTop -
				frame.contentWindow.innerHeight/2)
		);

	}

	if (encoding) {
		var docCharset = _('source-viewer', 'source').docShell
				.QueryInterface(Ci.nsIDocCharset);
		docCharset.charset = encoding;
	}

	_('source-viewer', 'source').addEventListener('load', onLoad, true);
	_('source-viewer', 'source').webNavigation.loadURI(
		sourceUrl,
		Ci.nsIWebNavigation.LOAD_FLAGS_BYPASS_CACHE,
		null, null, null
	);
}
	
function hideSource() 
{
	if (_('source-splitter').hidden) return;
	if (utils.getPref('extensions.uxu.mozunit.autoExpandWindow.sourceViewer')) {
		window.resizeBy(
			-_('source-splitter').boxObject.width
			-_('source-viewer').boxObject.width,
			0
		);
	}
	_('source-viewer').collapsed = true;
	_('source-splitter').hidden = true;
}
  
function goUpdateCommand(aCommand) 
{
	var node = document.getElementById(aCommand);
	if (!node) return;
	try {
		var controller = document.commandDispatcher.getControllerForCommand(aCommand);
		var enabled = false
		if (controller)
			enabled = controller.isCommandEnabled(aCommand);
		if (enabled)
			node.removeAttribute('disabled');
		else
			node.setAttribute('disabled', true);
	}
	catch(e) {
	}
}
 
function goDoCommand(aCommand) 
{
	try {
		var controller = document.commandDispatcher.getControllerForCommand(aCommand);
		if (controller && controller.isCommandEnabled(aCommand))
			controller.doCommand(aCommand);
	}
	catch(e) {
	}
}
 
function updateEditItems() 
{
	goUpdateCommand('cmd_copy');
}
 
function updateViewItems() 
{
	if (isLinux()) {
		_('alwaysRaised-menuitem').setAttribute('hidden', true);
	}
	else {
		var alwaysRaised = _('alwaysRaised');
		var win = getXULWindow();
		if (win.zLevel == win.normalZ)
			alwaysRaised.removeAttribute('checked');
		else
			alwaysRaised.setAttribute('checked', true);
	}

	var toggleContent = _('toggleContent');
	if (_('content').collapsed)
		toggleContent.removeAttribute('checked');
	else
		toggleContent.setAttribute('checked', true);
}
 
function updateTestCommands() 
{
	var file = _('file').value;
	if (file &&
		(file = utils.makeFileWithPath(file)) &&
		file.exists()) {
		_('run').removeAttribute('disabled');
		_('runPriority').removeAttribute('disabled');
		_('runAll').removeAttribute('disabled');
		_('runOptions-menu').removeAttribute('disabled');
		_('runOptions-button').removeAttribute('disabled');
		if (!file.isDirectory())
			_('edit').removeAttribute('disabled');
		else
			_('edit').setAttribute('disabled', true);
	}
	else {
		_('run').setAttribute('disabled', true);
		_('runPriority').setAttribute('disabled', true);
		_('runAll').setAttribute('disabled', true);
		_('runOptions-menu').setAttribute('disabled', true);
		_('runOptions-button').setAttribute('disabled', true);
		_('edit').setAttribute('disabled', true);
	}
}
 
function updateContextMenu() 
{
	updateEditItems();

	if (getFocusedPath()) {
		_('editThis-menuitem').removeAttribute('hidden');
		_('editThis-separator').removeAttribute('hidden');
	}
	else {
		_('editThis-menuitem').setAttribute('hidden', true);
		_('editThis-separator').setAttribute('hidden', true);
	}
}
 
function showPage(aURI) 
{
	var recentWindow = Cc['@mozilla.org/appshell/window-mediator;1']
		.getService(Ci.nsIWindowMediator)
		.getMostRecentWindow('navigator:browser');
	if (recentWindow) {
		if (recentWindow.content.location.href == 'about:blank')
			recentWindow.loadURI(aURI);
		else
			recentWindow.gBrowser.selectedTab = recentWindow.gBrowser.addTab(aURI);
	}
	else {
		try {
			window.open(aURI);
		}
		catch(e) {
			// Thunderbird
			var uri = Cc['@mozilla.org/network/io-service;1']
					.getService(Ci.nsIIOService)
					.newURI(aURI, null, null);
			var service = Cc['@mozilla.org/uriloader/external-protocol-service;1']
					.getService(Ci.nsIExternalProtocolService);
					service.loadUrl(uri);
		}
	}
}
 	 
