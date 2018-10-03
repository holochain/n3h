<a name="IpcServer"></a>

## IpcServer
IPC control api server

**Kind**: global class  

* [IpcServer](#IpcServer)
    * [new IpcServer()](#new_IpcServer_new)
    * [.bind(bindArray)](#IpcServer+bind) ⇒ <code>Promise</code>
    * [.call(data)](#IpcServer+call) ⇒ <code>array</code>

<a name="new_IpcServer_new"></a>

### new IpcServer()
create a new ipc server instance

**Example**  
```js
const srv = new IpcServer()
await srv.bind(['ipc://my-socket.ipc', 'tcp://*:12345'])
```
<a name="IpcServer+bind"></a>

### ipcServer.bind(bindArray) ⇒ <code>Promise</code>
Bind / create a listening socket for clients to connect to

**Kind**: instance method of [<code>IpcServer</code>](#IpcServer)  
**Returns**: <code>Promise</code> - resolved if all connections bind successfully  

| Param | Type | Description |
| --- | --- | --- |
| bindArray | <code>array</code> \| <code>string</code> | list of zmq endpoints to bind |

<a name="IpcServer+call"></a>

### ipcServer.call(data) ⇒ <code>array</code>
Transmit a `call` message to all ipc clients

**Kind**: instance method of [<code>IpcServer</code>](#IpcServer)  
**Returns**: <code>array</code> - array of response data from all clients  

| Param | Type | Description |
| --- | --- | --- |
| data | <code>Buffer</code> | the message content |

