<a name="IpcServer"></a>

## IpcServer
IPC control api server

**Kind**: global class  

* [IpcServer](#IpcServer)
    * [.init()](#IpcServer+init)
    * [.bind(bindArray)](#IpcServer+bind) ⇒ <code>Promise</code>
    * [.send()](#IpcServer+send)

<a name="IpcServer+init"></a>

### ipcServer.init()
create a new ipc server instance

**Kind**: instance method of [<code>IpcServer</code>](#IpcServer)  
<a name="IpcServer+bind"></a>

### ipcServer.bind(bindArray) ⇒ <code>Promise</code>
Bind / create a listening socket for clients to connect to

**Kind**: instance method of [<code>IpcServer</code>](#IpcServer)  
**Returns**: <code>Promise</code> - resolved if all connections bind successfully  

| Param | Type | Description |
| --- | --- | --- |
| bindArray | <code>array</code> \| <code>string</code> | list of zmq endpoints to bind |

<a name="IpcServer+send"></a>

### ipcServer.send()
broadcast an event to all clients

**Kind**: instance method of [<code>IpcServer</code>](#IpcServer)  
