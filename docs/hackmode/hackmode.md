<a name="N3hHackMode"></a>

## N3hHackMode
N3h "hackmode" prototyping code

Expects a config either over stdin or as a file `n3h-config.json` in the
working directory.
If neither is supplied, will load up the following default:

```
"webproxy": {
  "connection": {
    "rsaBits": 1024,
    "bind": [
      "wss://0.0.0.0:0/"
    ]
  },
  "wssAdvertise": "auto",
  "wssRelayPeers": null
}
```

Config Definitions:

- `webproxy.connection.rsaBits` {number} - rsa bits to use for tls on websocket server
- `webproxy.connection.bind` {array<uri>} - uri array of NICs to bind the websocket server. use host `0.0.0.0` for "all" NICs, use port `0` for random (os-assigned) port. You can specify a path, e.g. `"wss://127.0.0.1:8443/test/path/"`
- `webproxy.wssAdvertise` {uri|"auto"} - Cannot be paired with `wssRelayPeers`. Sets up this node to be directly connectable at this address. Special case if set to `"auto"` will pick the first public NIC binding... allowing for os-assigned ports.
- `webproxy.wssRelayPeers` {array<uri>} - Cannot be paired with `wssAdvertise`. Uri array of relay peers to connect through. (currently you can only specify 1). Use this if behind a NAT, all messages will be routed through the peer specified here.

**Kind**: global class  
