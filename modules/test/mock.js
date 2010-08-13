// API compatible to:
//  * MockObject.js http://micampe.it/projects/jsmock
//  * JSMock http://jsmock.sourceforge.net/

const EXPORTED_SYMBOLS = [
		'MockManager', 'Mock', 'FunctionMock', 'MockFunction', 'GetterMock', 'SetterMock',
		'TypeOf'
	];

var ns = {};
Components.utils.import('resource://uxu-modules/utils.js', ns);
Components.utils.import('resource://uxu-modules/test/assertions.js', ns);
Components.utils.import('resource://uxu-modules/lib/stringBundle.js', ns);

var utils = ns.utils;
var bundle = ns.stringBundle.get('chrome://uxu/locale/uxu.properties');

function MockManager(aAssertions)
{
	this._assert = aAssertions || new ns.Assertions();
	this.clear();
}
MockManager.prototype = {
	clear : function()
	{
		this._mocks = [];
	},
	assertAll : function()
	{
		this._mocks.forEach(function(aMock) {
			if ('assert' in aMock && typeof aMock.assert == 'function')
				aMock.assert();
		}, this);
	},
	Mock : function(aName, aSource)
	{
		var mock = new Mock(aName, aSource);
		mock._assert = this._assert;
		this._mocks.push(mock);
		return mock;
	},
	FunctionMock : function(aName, aSource)
	{
		var mock = new FunctionMock(aName, aSource);
		mock._mock._assert = this._assert;
		this._mocks.push(mock);
		return mock;
	},
	MockFunction : function() { return this.FunctionMock.apply(this, arguments); },
	GetterMock : function(aName, aSource)
	{
		var mock = new GetterMock(aName, aSource);
		mock._mock._assert = this._assert;
		this._mocks.push(mock);
		return mock;
	},
	SetterMock : function(aName, aSource)
	{
		var mock = new SetterMock(aName, aSource);
		mock._mock._assert = this._assert;
		this._mocks.push(mock);
		return mock;
	},
	// JSMock API
	verify : function()
	{
		this.assertAll();
	},
	createMock : function(aSource)
	{
		return this.Mock(aSource);
	},
	// JsMockito API
	when : function(aMock)
	{
		if (!aMock)
			throw new Error(bundle.getString('mock_manager_error_when_no_mock'));
		if (!('expect' in aMock) && !('expectThrows' in aMock))
			throw new Error(bundle.getFormattedString('mock_manager_error_when_not_mock', [utils.inspect(aMock)]));
		return aMock.expects();
	},
	export : function(aTarget)
	{
		var self = this;

		aTarget.Mock = function() { return self.Mock.apply(self, arguments); };
		aTarget.Mock.prototype = Mock.prototype;
		Mock.export(aTarget.Mock, this._assert);

		aTarget.FunctionMock = function() { return self.FunctionMock.apply(self, arguments); };
		aTarget.FunctionMock.prototype = FunctionMock.prototype;
		aTarget.MockFunction = aTarget.FunctionMock;
		aTarget.GetterMock = function() { return self.GetterMock.apply(self, arguments); };
		aTarget.GetterMock.prototype = GetterMock.prototype;
		aTarget.SetterMock = function() { return self.SetterMock.apply(self, arguments); };
		aTarget.SetterMock.prototype = SetterMock.prototype;

		// MockObject,js
		aTarget.MockObject = aTarget.MockCreate = aTarget.Mock;

		// JSMock
		aTarget.TypeOf = TypeOf;
		aTarget.MockControl = function() { return self; };

		// JsMockito
		aTarget.mock = aTarget.Mock;
		aTarget.mockFunction = aTarget.FunctionMock;
		aTarget.when = function() { return self.when.apply(self, arguments); };
		// JsHamcrest
		aTarget.anything = function() { return Mock.prototype.ANY_ONETIME; };
		aTarget.equalTo = function(aArg) { return aArg; };
	}
};

function Mock(aName, aSource, aAssertions)
{
	if (aName && typeof aName != 'string')
		[aSource, aAssertions, aName] = [aName, aSource, null];
	this._name = aName;
	this._methods = {};
	this._getters = {};
	this._setters = {};
	this._inExpectationChain = false;
	this._expectedCalls = [];
	this._assert = aAssertions || new ns.Assertions();
	if (aSource) {
		aSource = aSource.wrappedJSObject || aSource;
		switch (typeof aSource)
		{
			case 'function':
				this._name = this._name ||
				              (String(aSource).match(/function\s*([^\(]*)\s*\(/) && RegExp.$1) ||
				              this._defaultName;
				this._inherit(aSource.prototype);
				break;
			case 'object':
				this._name = this._name ||
				              (String(aSource.constructor).match(/function\s*([^\(]*)\s*\(/) && RegExp.$1) ||
				              this._defaultName;
				this._inherit(aSource);
				break;
			default:
				this._name = this._name || this._defaultName;
				break;
		}
	}
	else {
		this._name = this._name || this._defaultName;
	}
}
Mock.prototype = {
	ANY         : '0f18acc8-9b1f-4261-a220-32e1dfed83d2',
	ANY_ONETIME : '1843351e-0446-40ce-9bbd-cfd01d3c87a4',
	ALWAYS      : '11941072-0dc4-406b-a392-f57d36bb0b27',
	ONETIME     : '079e5fb7-0b5e-4139-b365-48455901f17b',
	NEVER       : '5b9a1df9-2c17-4fb4-9b3d-cdb860bf39a6',
	_defaultName : bundle.getString('mock_default_name'),
	_inherit : function(aSource)
	{
		for (let i in aSource)
		{
			if (i in this)
				continue;

			let getter = aSource.__lookupGetter__(i);
			if (getter) this.addGetter(i);
			let setter = aSource.__lookupSetter__(i);
			if (setter) this.addSetter(i);
			if (!getter && !setter) {
				if (typeof aSource[i] == 'function') {
					this.addMethod(i);
				}
				else {
					this.addGetter(i);
					this.addSetter(i);
				}
			}
		}
	},
	addMethod : function(aName, aAssertions)
	{
		var method = this[aName];
		if (!method || !('expect' in method)) {
			method = new FunctionMock(aName, null, aAssertions || this._assert);
			this._methods[aName] = method;
			this[aName] = method;
		}
		return method;
	},
	_addMethod : function() { return this.addMethod.apply(this, arguments); },
	addGetter : function(aName, aAssertions)
	{
		var getter = this._getters[aName];
		if (!getter || !('expect' in getter)) {
			getter = new GetterMock(aName, null, aAssertions || this._assert);
			this._getters[aName] = getter;
			this.__defineGetter__(aName, getter);
		}
		return getter;
	},
	_addGetter : function() { return this.addGetter.apply(this, arguments); },
	addSetter : function(aName, aAssertions)
	{
		var setter = this._setters[aName];
		if (!setter || !('expect' in setter)) {
			setter = new SetterMock(aName, null, aAssertions || this._assert);
			this._setters[aName] = setter;
			this.__defineSetter__(aName, setter);
		}
		return setter;
	},
	_addSetter : function() { return this.addSetter.apply(this, arguments); },

	__noSuchMethod__ : function(aName, aArguments)
	{
		throw new Error(bundle.getFormattedString(
					'mock_unexpected_call',
					[this._name, aName, utils.inspect(aArguments)]
				));
	},

	_addExpectedCall : function(aCall)
	{
		var self = this;
		this._expectedCalls.push(aCall);
		aCall.addHandler(function() {
			self._handleCall.call(self, this.firstExpectedCall);
		});
	},
	_handleCall : function(aCall)
	{
		this._assert.equals(this._expectedCalls[0], aCall);
		this._expectedCalls.shift();
	},

	expect : function(aName)
	{
		if (!arguments.length && !this._inExpectationChain)
			return this._createExpectationChain();

		var expectArgs = Array.slice(arguments, 1);
		if (!expectArgs.length) expectArgs.push([]);
		var method = this.addMethod(aName);
		var last = method.lastExpectedCall;
		method.expect.apply(method, expectArgs);
		if (method.lastExpectedCall != last)
			this._addExpectedCall(method.lastExpectedCall);
		return method;
	},
	_expect : function() { return this.expect.apply(this, arguments); },
	expects : function() { return this.expect.apply(this, arguments); },
	_expects : function() { return this.expect.apply(this, arguments); },
	expectThrows : function(aName)
	{
		var method = this.addMethod(aName);
		var last = method.lastExpectedCall;
		method.expectThrows.apply(method, Array.slice(arguments, 1));
		if (method.lastExpectedCall != last)
			this._addExpectedCall(method.lastExpectedCall);
		return method;
	},
	_expectThrows : function() {return  this.expectThrows.apply(this, arguments); },
	expectThrow : function() { return this.expectThrows.apply(this, arguments); },
	_expectThrow : function() { return this.expectThrows.apply(this, arguments); },
	expectRaises : function() { return this.expectThrows.apply(this, arguments); },
	_expectRaises : function() { return this.expectThrows.apply(this, arguments); },
	expectRaise : function() { return this.expectThrows.apply(this, arguments); },
	_expectRaise : function() { return this.expectThrows.apply(this, arguments); },

	expectGet : function(aName)
	{
		var expectArgs = Array.slice(arguments, 1);
		if (!expectArgs.length) expectArgs.push(void(0));
		var getter = this.addGetter(aName);
		var last = getter.lastExpectedCall;
		getter.expect.apply(getter, expectArgs);
		if (getter.lastExpectedCall != last)
			this._addExpectedCall(getter.lastExpectedCall);
		return getter;
	},
	_expectGet : function() { return this.expectGet.apply(this, arguments); },
	expectGetThrows : function(aName)
	{
		var getter = this.addGetter(aName);
		var last = getter.lastExpectedCall;
		getter.expectThrows.apply(getter, Array.slice(arguments, 1));
		if (getter.lastExpectedCall != last)
			this._addExpectedCall(getter.lastExpectedCall);
		return getter;
	},
	_expectGetThrows : function() { return this.expectGetThrows.apply(this, arguments); },
	expectGetThrow : function() { return this.expectGetThrows.apply(this, arguments); },
	_expectGetThrow : function() { return this.expectGetThrows.apply(this, arguments); },
	expectGetRaises : function() { return this.expectGetThrows.apply(this, arguments); },
	_expectGetRaises : function() { return this.expectGetThrows.apply(this, arguments); },
	expectGetRaise : function() { return this.expectGetThrows.apply(this, arguments); },
	_expectGetRaise : function() { return this.expectGetThrows.apply(this, arguments); },

	expectSet : function(aName)
	{
		var expectArgs = Array.slice(arguments, 1);
		if (!expectArgs.length) expectArgs.push(void(0));
		var setter = this.addSetter(aName);
		var last = setter.lastExpectedCall;
		setter.expect.apply(setter, expectArgs);
		if (setter.lastExpectedCall != last)
			this._addExpectedCall(setter.lastExpectedCall);
		return setter;
	},
	_expectSet : function() { return this.expectSet.apply(this, arguments); },
	expectSetThrows : function(aName)
	{
		var setter = this.addSetter(aName);
		var last = setter.lastExpectedCall;
		setter.expectThrows.apply(setter, Array.slice(arguments, 1));
		if (setter.lastExpectedCall != last)
			this._addExpectedCall(setter.lastExpectedCall);
		return setter;
	},
	_expectSetThrows : function() { return this.expectSetThrows.apply(this, arguments); },
	expectSetThrow : function() { return this.expectSetThrows.apply(this, arguments); },
	_expectSetThrow : function() { return this.expectSetThrows.apply(this, arguments); },
	expectSetRaises : function() { return this.expectSetThrows.apply(this, arguments); },
	_expectSetRaises : function() { return this.expectSetThrows.apply(this, arguments); },
	expectSetRaise : function() { return this.expectSetThrows.apply(this, arguments); },
	_expectSetRaise : function() { return this.expectSetThrows.apply(this, arguments); },

	// JSMock API
	addMockMethod : function(aName)
	{
		this.addMethod(aName);
	},

	// JSMock, JsMockito
	_createExpectationChain : function()
	{
		var self = this;
		this._inExpectationChain = true;
		return {
			__noSuchMethod__ : function(aName, aArguments) {
				var method = self.addMethod(aName);
				var last = method.lastExpectedCall;
				method.expect(aArguments);
				if (method.lastExpectedCall != last)
					self._addExpectedCall(method.lastExpectedCall);
				self._inExpectationChain = false;
				return method;
			}
		};
	},

	assert : function()
	{
		for (let i in this._getters)
		{
			this._getters[i].assert();
		}
		for (let i in this._setters)
		{
			this._setters[i].assert();
		}
		for (let i in this._methods)
		{
			this._methods[i].assert();
		}
	},
	_assert  : function() { this.assert(); },
	verify : function() { this.assert(); },
	_verify : function() { this.assert(); }
};

Mock.getMockFor = function(aObject, aName, aAssertions) {
	if (!aObject)
		throw new Error(bundle.getString('mock_error_creation_no_target'));
	if (typeof aObject != 'object')
		throw new Error(bundle.getFormattedString('mock_error_creation_invalid_target', [utils.inspect(aObject)]));
	return (aObject.__uxu__mock = aObject.__uxu__mock || new Mock(aName, aObject, aAssertions));
};
Mock.addMethod = function(aObject, aName, aAssertions) {
	var method = this.getMockFor(aObject).addMethod(aName, aAssertions);
	if (aObject[aName] != method) aObject[aName] = method;
	return method;
};
Mock.addGetter = function(aObject, aName, aAssertions) {
	var getter = this.getMockFor(aObject).addGetter(aName, aAssertions);
	if (aObject.__lookupGetter__(aName) != getter) aObject.__defineGetter__(aName, getter);
	return getter;
};
Mock.addSetter = function(aObject, aName, aAssertions) {
	var setter = this.getMockFor(aObject).addSetter(aName, aAssertions);
	if (aObject.__lookupSetter__(aName) != setter) aObject.__defineSetter__(aName, setter);
	return setter;
};

Mock.expect = function(aObject, aName) {
	var mock = this.getMockFor(aObject);
	this.addMethod(aObject, aName);
	return mock.expect.apply(mock, Array.slice(arguments, 1));
};
Mock.expects = Mock.expect;
Mock.expectThrows = function(aObject, aName) {
	var mock = this.getMockFor(aObject);
	this.addMethod(aObject, aName);
	return mock.expectThrows.apply(mock, Array.slice(arguments, 1));
};
Mock.expectRaise = Mock.expectRaises = Mock.expectThrow = Mock.expectThrows;

Mock.expectGet = function(aObject, aName) {
	var mock = this.getMockFor(aObject);
	this.addGetter(aObject, aName);
	return mock.expectGet.apply(mock, Array.slice(arguments, 1));
};
Mock.expectGetThrows = function(aObject, aName) {
	var mock = this.getMockFor(aObject);
	this.addGetter(aObject, aName);
	return mock.expectGetThrows.apply(mock, Array.slice(arguments, 1));
};
Mock.expectGetRaise = Mock.expectGetRaises = Mock.expectGetThrow = Mock.expectGetThrows;

Mock.expectSet = function(aObject, aName) {
	var mock = this.getMockFor(aObject);
	this.addSetter(aObject, aName);
	return mock.expectSet.apply(mock, Array.slice(arguments, 1));
};
Mock.expectSetThrows = function(aObject, aName) {
	var mock = this.getMockFor(aObject);
	this.addSetter(aObject, aName);
	return mock.expectSetThrows.apply(mock, Array.slice(arguments, 1));
};
Mock.expectSetRaise = Mock.expectSetRaises = Mock.expectSetThrow = Mock.expectSetThrows;

Mock.ANY         = Mock.prototype.ANY;
Mock.ANY_ONETIME = Mock.prototype.ANY_ONETIME;
Mock.ALWAYS      = Mock.prototype.ALWAYS;
Mock.ONETIME     = Mock.prototype.ONETIME;
Mock.NEVER       = Mock.prototype.NEVER;
Mock.export = function(aTarget, aAssertions) {
	aAssertions = aAssertions || new ns.Assertions();
	var self = this;

	aTarget.ANY         = this.prototype.ANY;
	aTarget.ANY_ONETIME = this.prototype.ANY_ONETIME;
	aTarget.ALWAYS      = this.prototype.ALWAYS;
	aTarget.ONETIME     = this.prototype.ONETIME;
	aTarget.NEVER       = this.prototype.NEVER;

	aTarget.addMethod = function(aObject, aName) {
		return self.addMethod(aObject, aName, aAssertions);
	};
	aTarget.addSetter = function(aObject, aName) {
		return self.addSetter(aObject, aName, aAssertions);
	};
	aTarget.addGetter = function(aObject, aName) {
		return self.addGetter(aObject, aName, aAssertions);
	};

	aTarget.expect = function(aObject) {
		return self.expect.apply(self, [aObject, aAssertions].concat(Array.slice(arguments, 1)));
	};
	aTarget.expecs = aTarget.expect;
	aTarget.expectThrows = function(aObject) {
		return self.expectThrows.apply(self, [aObject, aAssertions].concat(Array.slice(arguments, 1)));
	};
	aTarget.expectRaise = aTarget.expectRaises = aTarget.expectThrow = aTarget.expectThrows;

	aTarget.expectGet = function(aObject) {
		return self.expectGet.apply(self, [aObject, aAssertions].concat(Array.slice(arguments, 1)));
	};
	aTarget.expectGetThrows = function(aObject) {
		return self.expectGetThrows.apply(self, [aObject, aAssertions].concat(Array.slice(arguments, 1)));
	};
	aTarget.expectGetRaise = aTarget.expectGetRaises = aTarget.expectGetThrow = aTarget.expectGetThrows;

	aTarget.expectSet = function(aObject) {
		return self.expectSet.apply(self, [aObject, aAssertions].concat(Array.slice(arguments, 1)));
	};
	aTarget.expectSetThrows = function(aObject) {
		return self.expectSetThrows.apply(self, [aObject, aAssertions].concat(Array.slice(arguments, 1)));
	};
	aTarget.expectSetRaise = aTarget.expectSetRaises = aTarget.expectSetThrow = aTarget.expectSetThrows;

	aTarget.export = function(aObject) {
		self.export(aObject, aAssertions);
	};
};


function ExpectedCall(aOptions)
{
	this._arguments = [];
	this.handlers   = [];

	if ('arguments' in aOptions)
		this.arguments = aOptions.arguments;
	if ('returnValue' in aOptions)
		this.returnValue = aOptions.returnValue;
	if ('exceptionClass' in aOptions)
		this.exceptionClass = aOptions.exceptionClass;
	if ('exceptionMessage' in aOptions)
		this.exceptionMessage = aOptions.exceptionMessage;
}
ExpectedCall.prototype = {
	addHandler : function(aHandler)
	{
		this.handlers.push(aHandler);
	},
	onCall : function(aMock, aArguments)
	{
		this.handlers.forEach(function(aHandler) {
			if (aHandler && typeof aHandler == 'function')
				aHandler.apply(aMock, aArguments);
		}, aMock);
	},
	finish : function(aArguments)
	{
		if ('exceptionClass' in this) {
			let exception = this.exceptionClass;
			if (typeof exception == 'function')
				exception = new this.exceptionClass(this.exceptionMessage);
			throw exception;
		}
		return typeof this.returnValue == 'function' ?
				this.returnValue.apply(null, aArguments) :
				this.returnValue ;
	},
	get arguments()
	{
		return this._arguments;
	},
	set arguments(aValue)
	{
		if (utils.isArray(aValue)) {
			this._arguments = aValue;
		}
		else {
			this._arguments = [aValue];
		}
		return this._arguments;
	},
	isAnyCall : function()
	{
		return this.arguments[0] == Mock.prototype.ANY || this.arguments[0] == Mock.prototype.ALWAYS;
	},
	isOneTimeAnyCall : function()
	{
		return this.arguments[0] == Mock.prototype.ANY_ONETIME || this.arguments[0] == Mock.prototype.ONETIME;
	}
};

function FunctionMock(aName, aSource, aAssertions)
{
	if (aName && typeof aName != 'string')
		[aSource, aAssertions, aName] = [aName, aSource, null];
	this.init(aName, aSource, aAssertions);
	return this.createFunction();
}
FunctionMock.prototype = {
	defaultName : bundle.getString('function_mock_default_name'),
	init : function(aName, aSource, aAssertions)
	{
		aName = aName || (String(aSource).match(/function\s*([^\(]*)\s*\(/) && RegExp.$1);
		this.name = aName || this.defaultName || '';

		this.inExpectationChain = false;
		this.expectedCalls = [];
		this.anyCall = null;
		this._assert = aAssertions || new ns.Assertions();
		this.errorsCount = 0;
		this.totalCount = 0;
	},
	createFunction : function()
	{
		var self = this;
		var func = function() { return self.onCall(this, Array.slice(arguments)); };
		func._mock = this;
		this.export(func);

		return func;
	},
	get calledCount()
	{
		return this.totalCount - this.expectedCalls.length;
	},
	get firstExpectedCall()
	{
		var calls = this.expectedCalls;
		return calls.length ? calls[0] : null ;
	},
	get lastExpectedCall()
	{
		var calls = this.expectedCalls;
		return calls.length ? calls[calls.length-1] : null ;
	},
	getCurrentCall : function(aMessage)
	{
		if (!this.anyCall && !this.expectedCalls.length) {
			this.errorsCount++;
			throw new Error(aMessage);
		}
		return this.anyCall || this.firstExpectedCall;
	},
	addExpectedCall : function(aOptions)
	{
		var call = new ExpectedCall(aOptions);
		if (call.isAnyCall()) {
			this.anyCall = call;
			return null;
		}
		else {
			this.anyCall = null;
			this.expectedCalls.push(call);
			this.totalCount++;
			return call;
		}
	},
	isSpecialSpec : function(aArgument)
	{
		return (
			aArgument == Mock.prototype.ALWAYS ||
			aArgument == Mock.prototype.ONETIME ||
			aArgument == Mock.prototype.ANY ||
			aArgument == Mock.prototype.ANY_ONETIME ||
			aArgument == Mock.prototype.NEVER
		);
	},
	// JSMock, JsMockito
	createExpectationChain : function()
	{
		this.inExpectationChain = true;
		var self = this;
		return function() {
			self.expect(Array.slice(arguments));
			if (this != self)
				self.lastExpectedCall.context = this;
			self.inExpectationChain = false;
			return self;
		};
	},
	expect : function(aArguments, aReturnValue)
	{
		if (!arguments.length && !this.inExpectationChain)
			return this.createExpectationChain();
		if (aArguments != Mock.prototype.NEVER)
			this.addExpectedCall({
				arguments   : aArguments,
				returnValue : aReturnValue
			});
		return this;
	},
	expects : function() { return this.expect.apply(this, arguments); },
	expectThrows : function(aArguments, aExceptionClass, aExceptionMessage)
	{
		if (!aExceptionClass)
			throw new Error(bundle.getFormattedString('mock_error_no_exception', [this.name]));
		this.addExpectedCall({
			arguments        : aArguments,
			exceptionClass   : aExceptionClass,
			exceptionMessage : aExceptionMessage
		});
		return this;
	},
	expectThrow : function() { return this.expectThrows.apply(this, arguments); },
	expectRaises : function() { return this.expectThrows.apply(this, arguments); },
	expectRaise : function() { return this.expectThrows.apply(this, arguments); },

	bindTo : function(aTarget)
	{
		this.lastExpectedCall.context = aTarget;
	},
	boundTo : function(aTarget) { return this.bindTo.apply(this, arguments); },
	andBindTo : function(aTarget) { return this.bindTo.apply(this, arguments); },
	andBoundTo : function(aTarget) { return this.bindTo.apply(this, arguments); },

	// JSMock API
	andReturn : function(aValue)
	{
		var call = this.lastExpectedCall;
		call.returnValue = aValue;
		return this;
	},
	andReturns : function() { return this.andReturn.apply(this, arguments); }, // extended from JSMock
	andThrow : function(aExceptionClass, aExceptionMessage)
	{
		var call = this.lastExpectedCall;
		call.exceptionClass = aExceptionClass;
		call.exceptionMessage = aExceptionMessage;
		return this;
	},
	andThrows : function() { return this.andReturn.apply(this, arguments); }, // extended from JSMock
	andStub : function(aHandler)
	{
		if (!aHandler)
			throw new Error(bundle.getFormattedString('function_mock_no_stub', [this.name, 'andStub']));
		if (typeof aHandler != 'function')
			throw new Error(bundle.getFormattedString('function_mock_not_stub', [this.name, 'andStub', utils.inspect(aHandler)]));
		var call = this.lastExpectedCall;
		call.addHandler(aHandler);
		return this;
	},

	// JsMockito API
	thenReturn : function() { return this.andReturn.apply(this, arguments); },
	thenReturns : function() { return this.andReturn.apply(this, arguments); }, // extended from JsMockito
	thenThrow : function() { return this.andThrow.apply(this, arguments); },
	thenThrows : function() { return this.andThrow.apply(this, arguments); }, // extended from JsMockito
	then : function(aHandler)
	{
		if (!aHandler)
			throw new Error(bundle.getFormattedString('function_mock_no_stub', [this.name, 'then']));
		if (typeof aHandler != 'function')
			throw new Error(bundle.getFormattedString('function_mock_not_stub', [this.name, 'then', utils.inspect(aHandler)]));
		return this.andStub.apply(this, arguments);
	},

	onCall : function(aContext, aArguments)
	{
		var call = this.getCurrentCall(bundle.getFormattedString(
						'function_mock_unexpected_call',
						[this.name, utils.inspect(aArguments)]
					));

		if (!call.isAnyCall() && !call.isOneTimeAnyCall())
			this._assert.equals(
				this.formatArgumentsArray(call.arguments, aArguments),
				aArguments,
				bundle.getFormattedString('function_mock_wrong_arguments', [this.name])
			);

		if ('context' in call)
			this._assert.equals(
				call.context,
				aContext,
				bundle.getFormattedString('function_mock_wrong_context', [this.name, utils.inspect(aArguments)])
			);

		call.onCall(this, aArguments);

		if (!this.anyCall)
			this.expectedCalls.shift();

		return call.finish(aArguments);
	},
	formatArgumentsArray : function(aExpectedArray, aActualArray)
	{
		return aExpectedArray.map(function(aExpected, aIndex) {
			if (aExpected instanceof TypeOf) {
				let actual = aActualArray[aIndex];
				this._assert.isDefined(actual);
				this._assert.isInstanceOf(aExpected.expectedConstructor, actual)
				return actual;
			}
			else {
				return aExpected;
			}
		}, this);
	},
	assert : function()
	{
		if (this.errorsCount)
			throw new Error(bundle.getFormattedString(
						'function_mock_assert_error',
						[this.name, this.errorsCount]
					));
		this._assert.equals(
			this.totalCount,
			this.calledCount,
			bundle.getFormattedString('function_mock_assert_fail', [this.name])
		);
	},
	verify : function() { this.assert(); },
	export : function(aTarget)
	{
		var self = this;
		['assert', 'verify',
		 'expect', 'expects',
		 'expectThrows', 'expectThrow',
		 'bindTo', 'boundTo',
		 'andBindTo', 'andBoundTo',
		 'andReturn', 'andReturns',
		 'andThrow', 'andThrows',
		 'andStub',
		 'thenReturn', 'thenReturns',
		 'thenThrow', 'thenThrows',
		 'then'].forEach(function(aMethod) {
			aTarget[aMethod] = function() { return self[aMethod].apply(self, arguments); }
			aTarget['_'+aMethod] = function() { return self[aMethod].apply(self, arguments); }
		}, this);
		['firstExpectedCall', 'lastExpectedCall'].forEach(function(aName) {
			aTarget.__defineGetter__(aName, function() { return self[aName]; });
		}, this);
	}
};

var MockFunction = FunctionMock;

function GetterMock(aName, aSource, aAssertions)
{
	if (aName && typeof aName != 'string')
		[aSource, aAssertions, aName] = [aName, aSource, null];
	this.init(aName, aSource, aAssertions);
	return this.createFunction();
}
GetterMock.prototype = {
	__proto__ : FunctionMock.prototype,
	defaultName : bundle.getString('getter_mock_default_name'),
	expect : function(aReturnValue)
	{
		var args = [];
		if (this.isSpecialSpec(aReturnValue))
			[args, aReturnValue] = Array.slice(arguments);
		if (args != Mock.prototype.NEVER)
			this.addExpectedCall({
				arguments   : args,
				returnValue : aReturnValue
			});
		return this;
	},
	expectThrows : function(aExceptionClass, aExceptionMessage)
	{
		var args = [];
		if (
			aExceptionMessage &&
			this.isSpecialSpec(aExceptionClass)
			) {
			[args, aExceptionClass, aExceptionMessage] = Array.slice(arguments);
		}
		if (!aExceptionClass)
			throw new Error(bundle.getFormattedString('mock_error_no_exception', [this.name]));
		this.addExpectedCall({
			arguments        : args,
			exceptionClass   : aExceptionClass,
			exceptionMessage : aExceptionMessage
		});
		return this;
	},
	onCall : function(aContext)
	{
		var call = this.getCurrentCall(bundle.getFormattedString('getter_mock_unexpected_call', [this.name]));

		if ('context' in call)
			this._assert.equals(
				call.context,
				aContext,
				bundle.getFormattedString('getter_mock_wrong_context', [this.name])
			);

		call.onCall(this, []);

		if (!this.anyCall)
			this.expectedCalls.shift();

		return call.finish([]);
	},
	assert : function()
	{
		if (this.errorsCount)
			throw new Error(bundle.getFormattedString(
						'getter_mock_assert_error',
						[this.name, this.errorsCount]
					));
		this._assert.equals(
			this.totalCount,
			this.calledCount,
			bundle.getFormattedString('getter_mock_assert_fail', [this.name])
		);
	}
};

function SetterMock(aName, aSource, aAssertions)
{
	if (aName && typeof aName != 'string')
		[aSource, aAssertions, aName] = [aName, aSource, null];
	this.init(aName, aSource, aAssertions);
	return this.createFunction();
}
SetterMock.prototype = {
	__proto__ : FunctionMock.prototype,
	defaultName : bundle.getString('setter_mock_default_name'),
	expect : function(aArgument, aReturnValue)
	{
		if (aArgument == Mock.prototype.NEVER)
			return;
		var call = this.addExpectedCall({
				arguments   : [aArgument],
				returnValue : aReturnValue
			});
		if (call && arguments.length < 2)
			call.returnValue = aArgument;
		return this;
	},
	expectThrows : function(aArgument, aExceptionClass, aExceptionMessage)
	{
		if (!aExceptionClass)
			throw new Error(bundle.getFormattedString('mock_error_no_exception', [this.name]));
		this.addExpectedCall({
			arguments        : [aArgument],
			exceptionClass   : aExceptionClass,
			exceptionMessage : aExceptionMessage
		});
		return this;
	},
	onCall : function(aContext, aArguments)
	{
		if (!aArguments.length) aArguments = [void(0)];

		var call = this.getCurrentCall(bundle.getFormattedString(
				'setter_mock_unexpected_call',
				[this.name, utils.inspect(aArguments[0])]
			));

		if (!call.isAnyCall() && !call.isOneTimeAnyCall())
			this._assert.equals(
				this.formatArgumentsArray(call.arguments, aArguments),
				aArguments,
				bundle.getFormattedString('setter_mock_wrong_value', [this.name])
			);

		if ('context' in call)
			this._assert.equals(
				call.context,
				aContext,
				bundle.getFormattedString('setter_mock_wrong_context', [this.name, utils.inspect(aArguments[0])])
			);

		call.onCall(this, aArguments);

		if (!this.anyCall)
			this.expectedCalls.shift();

		return call.finish([]);
	},
	assert : function()
	{
		if (this.errorsCount)
			throw new Error(bundle.getFormattedString(
						'setter_mock_assert_error',
						[this.name, this.errorsCount]
					));
		this._assert.equals(
			this.totalCount,
			this.calledCount,
			bundle.getFormattedString('setter_mock_assert_fail', [this.name])
		);
	}
};

// JSMock API
function TypeOf(aConstructor) {
	if (this instanceof TypeOf) {
		this.expectedConstructor = aConstructor;
	}
	else {
		return new TypeOf(aConstructor);
	}
}
TypeOf.isA = function(aConstructor) {
	return TypeOf(aConstructor);
};
