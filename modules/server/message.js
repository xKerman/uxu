if (typeof window == 'undefined')
	this.EXPORTED_SYMBOLS = ['Message'];

const Cc = Components.classes;
const Ci = Components.interfaces;

var TransportService = Cc['@mozilla.org/network/socket-transport-service;1'] 
		.getService(Ci.nsISocketTransportService);

function Message(aMessage, aHost, aPort, aListener) 
{
	if (!aHost) aHost = 'localhost';

	this._message = (aMessage || '')+'\n';
	this._listener = aListener;
	this._buffer = '';

	var transport = TransportService.createTransport(null, 0, aHost, aPort, null);
	this._output = transport.openOutputStream(0, 0, 0);
	this._input = transport.openInputStream(0, 0, 0);
	this._scriptableInput = Cc['@mozilla.org/scriptableinputstream;1']
				.createInstance(Ci.nsIScriptableInputStream);
	this._scriptableInput.init(this._input);

	this._output.write(this._message, this._message.length);

	this.__defineGetter__('message', function() {
		return this._message;
	});
}

Message.prototype = {
	send : function()
	{
		var pump = Cc['@mozilla.org/network/input-stream-pump;1']
				.createInstance(Ci.nsIInputStreamPump);
		pump.init(this._input, -1, -1, 0, 0, false);
		pump.asyncRead(this, null);
	},

	onStartRequest : function(aRequest, aContext)
	{
	},

	onStopRequest : function(aRequest, aContext, aStatus)
	{
		this.destroy();
	},

	onDataAvailable : function(aRequest, aContext, aInputStream, aOffset, aCount)
	{
		var chunk = this._scriptableInput.read(aCount);
		if (/[\r\n]+$/.test(chunk)) {
			if (this._remoteResultBuffer) {
				chunk = this._buffer + chunk;
				this._buffer = '';
			}
			if (this._listener && this._listener.onResponse) {
				this._listener.onResponse(chunk.replace(/[\r\n]+$/, ''));
			}
		}
		else {
			this._buffer += chunk;
		}
	},

	destroy : function()
	{
		this._scriptableInput.close();
		this._input.close();
		this._output.close();
	}
};