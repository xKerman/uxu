var description = 'Sandboxを使用しないGreasemonkeyスクリプトのテスト';
var isAsync = true;

var script = 'greasemonkey.user.js';

function setUp() {
	include(script);
}

function tearDown() {
}

testNormalFunction.description = 'GM関数にアクセスしない例';
function testNormalFunction() {
	assert.equals(
		'MozUnit\nchrome://uxu/content/ui/mozunit.xul',
		getDocumentTitleAndURI()
	);
}

testGMFunctionAccess.description = 'GM関数にアクセスする例';
function testGMFunctionAccess() {
	var listener = {
			key   : null,
			value : null,
			onGM_setValueCall : function(aEvent) {
				this.key = aEvent.key;
				this.value = aEvent.value;
			}
		};
	greasemonkey.addListener(listener);

	setAndGetValue();
	assert.equals('testKey', listener.key);
	assert.equals('testValue', listener.value);
}

testGMFunctionResult.description = 'GM関数にアクセスした結果を捕捉する例';
function testGMFunctionResult() {
	var value = setAndGetValue();
	assert.equals(
		'testValue',
		value
	);
}

testGMXMLHttpRequest.description = 'GM_xmlhttpRequestを使った関数のテストの例';
function testGMXMLHttpRequest() {
	var listener = {
			details : null,
			onGM_xmlhttpRequestCall : function(aEvent) {
				this.details = aEvent.details;
			},
			onGM_xmlhttpRequestLoad : function(aEvent) {
				this.loaded.value = true;
			},
			loaded : {
				value : false
			}
		};
	greasemonkey.addListener(listener);

	assert.isNull(servicePageTitle);
	getServicesPageTitle();
	assert.isNotNull(listener.details);
	yield listener.loaded;
	assert.equals('サービス -ClearCode Inc.', servicePageTitle);
}

