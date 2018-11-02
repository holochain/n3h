<a name="IpcClient"></a>

## IpcClient
IPC connection client helper

**Kind**: global class  

* [IpcClient](#IpcClient)
    * [.init()](#IpcClient+init)
    * [.connect(endpoint)](#IpcClient+connect) ⇒ <code>Promise</code>

<a name="IpcClient+init"></a>

### ipcClient.init()
create a new IpcClient instance

**Kind**: instance method of [<code>IpcClient</code>](#IpcClient)  
<a name="IpcClient+connect"></a>

### ipcClient.connect(endpoint) ⇒ <code>Promise</code>
Connect this instance to a server socket

**Kind**: instance method of [<code>IpcClient</code>](#IpcClient)  
**Returns**: <code>Promise</code> - - resolved if connection is a success  

| Param | Type | Description |
| --- | --- | --- |
| endpoint | <code>string</code> | the zmq socket to connect to |

