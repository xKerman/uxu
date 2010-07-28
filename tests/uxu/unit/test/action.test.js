var topDir = baseURL+'../../../../';

var ns = {};
[
	topDir+'modules/test/action.js'
].forEach(function(aURI) {
	utils.include({
		uri                    : aURI,
		encoding               : 'Shift_JIS',
		allowOverrideConstants : true,
		namespace              : ns
	});
}, this);
var ActionsClass = ns.Action;

var actionModule;

function setUp()
{
	actionModule = new ActionsClass(utils);
}

function tearDown()
{
	actionModule.destroy();
}


function test_readyToOK()
{
	actionModule.readyToOK();
	var before = Date.now();
	alert('click OK');
	assert.compare(500, '>', Date.now() - before);
}

function test_readyToConfirm()
{
	var before = Date.now();
	actionModule.readyToConfirm(true);
	var result = confirm('click OK');
	assert.isTrue(result);
	assert.compare(500, '>', Date.now() - before);

	before = Date.now();
	actionModule.readyToConfirm(false);
	result = confirm('click Cancel');
	assert.isFalse(result);
	assert.compare(500, '>', Date.now() - before);
}

function test_readyToPrompt()
{
	var before = Date.now();
	actionModule.readyToPrompt('input');
	var result = prompt('test');
	assert.equals('input', result);
	assert.compare(500, '>', Date.now() - before);
}
