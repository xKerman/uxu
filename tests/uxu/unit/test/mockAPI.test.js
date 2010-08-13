utils.include('./mock.inc.js');

var mock;
var manager;

function setUp()
{
}

function tearDown()
{
}

function test_TypeOf()
{
	assert.isInstanceOf(TypeOf, TypeOf.isA(Array));
	assert.isInstanceOf(TypeOf, new TypeOf(Array));
	assert.isInstanceOf(TypeOf, TypeOf(Array));
}

function test_JSMockStyle()
{
	var mock = new Mock();
	assertCallAdded(mock, function() {
		mock.expects().methodWithoutArg();
	});
	assertCallAdded(mock, function() {
		mock.expects().methodWithArg(29).andReturn(290);
	});
	assertCallAdded(mock, function() {
		mock.expects().methodWithArg(290).andThrow('my error');
	});
	var count = 0;
	assertCallAdded(mock, function() {
		mock.expects().methodWithArg(2900).andStub(function() {
			count += 1;
		});
	});
	assertCallAdded(mock, function() {
		mock.expects().methodWithArg(29000).andReturn(2.9).andStub(function() {
			count += 10;
		});
	});
	assertCallAdded(mock, function() {
		mock.expects().methodWithArg(TypeOf.isA(String));
	});
	assertCallAdded(mock, function() {
		mock.expects().methodWithArg(TypeOf(Array));
	});

	assertCallRemoved(mock, function() {
		assert.isUndefined(mock.methodWithoutArg());
	});
	assertCallRemoved(mock, function() {
		assert.equals(290, mock.methodWithArg(29));
	});
	assertCallRemoved(mock, function() {
		assert.raises(
			'my error',
			function() {
				mock.methodWithArg(290);
			}
		);
	});
	assertCallRemoved(mock, function() {
		mock.methodWithArg(2900);
		assert.equals(1, count);
	});
	assertCallRemoved(mock, function() {
		assert.equals(2.9, mock.methodWithArg(29000));
		assert.equals(11, count);
	});
	assertCallRemoved(mock, function() {
		mock.methodWithArg(new String('string'));
	});
	assertCallRemoved(mock, function() {
		mock.methodWithArg(new Array(3));
	});

	mock.assert();
}

function test_JsMockitoStyle()
{
	var manager = new MockManager();

	var mock = new Mock();
	assertCallAdded(mock, function() {
		manager.when(mock).methodWithoutArg();
	});
	assertCallAdded(mock, function() {
		manager.when(mock).methodWithArg(29).thenReturn(290);
	});
	assertCallAdded(mock, function() {
		manager.when(mock).methodWithArg(290).thenThrow('my error');
	});
	var count = 0;
	assertCallAdded(mock, function() {
		manager.when(mock).methodWithArg(2900).then(function() {
			count += 1;
		});
	});
	assertCallAdded(mock, function() {
		manager.when(mock).methodWithArg(29000).thenReturn(2.9).then(function() {
			count += 10;
		});
	});
	assertCallAdded(mock, function() {
		manager.when(mock).methodWithArg(Mock.prototype.ANY_ONETIME).thenReturn('ANY');
	});

	assertCallRemoved(mock, function() {
		assert.isUndefined(mock.methodWithoutArg());
	});
	assertCallRemoved(mock, function() {
		assert.equals(290, mock.methodWithArg(29));
	});
	assertCallRemoved(mock, function() {
		assert.raises(
			'my error',
			function() {
				mock.methodWithArg(290);
			}
		);
	});
	assertCallRemoved(mock, function() {
		mock.methodWithArg(2900);
		assert.equals(1, count);
	});
	assertCallRemoved(mock, function() {
		assert.equals(2.9, mock.methodWithArg(29000));
		assert.equals(11, count);
	});
	assertCallRemoved(mock, function() {
		mock.methodWithArg('anything');
	});

	mock.assert();
}

function test_JsMockitoStyle_functionMock()
{
	var manager = new MockManager();
	var mock = new FunctionMock();

	assertCallAdded(mock, function() {
		manager.when(mock)();
	});
	assertCallAdded(mock, function() {
		manager.when(mock)(29).thenReturn(290);
	});
	assertCallAdded(mock, function() {
		manager.when(mock)(290).thenThrow('my error');
	});
	var count = 0;
	assertCallAdded(mock, function() {
		manager.when(mock)(2900).then(function() {
			count += 1;
		});
	});
	assertCallAdded(mock, function() {
		manager.when(mock)(29000).thenReturn(2.9).then(function() {
			count += 10;
		});
	});
	var context = {};
	assertCallAdded(mock, function() {
		manager.when(mock).call(context, 10).thenReturn('OK');
	});
	assertCallAdded(mock, function() {
		manager.when(mock)(Mock.prototype.ANY_ONETIME).thenReturn('ANY');
	});

	assertCallRemoved(mock, function() {
		assert.isUndefined(mock());
	});
	assertCallRemoved(mock, function() {
		assert.equals(290, mock(29));
	});
	assertCallRemoved(mock, function() {
		assert.raises(
			'my error',
			function() {
				mock(290);
			}
		);
	});
	assertCallRemoved(mock, function() {
		mock(2900);
		assert.equals(1, count);
	});
	assertCallRemoved(mock, function() {
		assert.equals(2.9, mock(29000));
		assert.equals(11, count);
	});
	assertCallRaise(mock, [10], 'AssertionFailed');
	assertCallRemoved(mock, function() {
		context.method = mock;
		context.method(10);
	});
	assertCallRemoved(mock, function() {
		mock('anything');
	});

	mock.assert();
}
