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
		document.title+'\n'+window.location.href,
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
	assert.isNull(pageTitle);
        utils.log(utils.fixupIncompleteURI("service.html"));
	yield Do(greasemonkey.doAndWaitLoad(function() {
			getPageTitle(utils.fixupIncompleteURI("service.html"));
		}));
	assert.equals('サービス - クリアコード', pageTitle);
}

