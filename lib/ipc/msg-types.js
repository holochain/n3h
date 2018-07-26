/*!
 * n3h IPC constants and message descriptions
 */

/// ipc server magic identifier
exports.SRV_ID = Buffer.from([0x24, 0x24, 0x24, 0x24])

/// these message types are sent out by clients to the p2p IPC socket
exports.MSG_CLI = {
  _RES_AUTH_1: 0x00, // reserved for authentication
  _RES_AUTH_2: 0x01, // reserved for authentication

  /* client initiated heartbeat
   *
   * [0x02, msgpack(
   *   (int) // start-time millis epoch timestamp
   * )]
   */
  PING: 0x02,

  /* publish a fire/forget message to the specified node
   *
   * [0x03, msgpack(
   *   array[
   *     (binary), // local-only message identifier
   *     (binary), // to address
   *     (binary), // message data
   *   ]
   * )]
   */
  SEND: 0x03,

  /* send a message to a node, and await a response
   *
   * [0x04, msgpack(
   *   array[
   *     (binary), // local-only message identifier
   *     (binary), // remote message identifier
   *     (binary), // to address
   *     (binary), // message data
   *   ]
   * )]
   */
  CALL: 0x04,

  /* send a call response back to the node that made the original request
   *
   * [0x05, msgpack(
   *   array[
   *     (binary), // local-only message identifier
   *     (binary), // remote message identifier
   *     (binary), // to address
   *     (binary), // massage data
   *   ]
   * )]
   */
  CALL_RESP: 0x05
}

/// clients receive these message types from the p2p IPC socket
exports.MSG_SRV = {
  _RES_AUTH_1: 0x00, // reserved for authentication
  _RES_AUTH_2: 0x01, // reserved for authentication

  /* response to client initiated heartbeat
   *
   * [0x02, msgpack(
   *   array[
   *     (int), // start-time millis epoch timestamp
   *     (int), // server response time millis epoch timestamp
   *   ]
   * )]
   */
  PONG: 0x02,

  /* server was able to process the request
   *
   * [0x03, msgpack(
   *   (binary), // local-only message identifier
   * )]
   */
  RESP_OK: 0x03,

  /* server was un-able to process the request
   *
   * [0x04, msgpack(
   *   array[
   *     (binary), // local-only message identifier
   *     (int),    // error code
   *     (string), // error message
   *   ]
   * )]
   */
  RESP_FAIL: 0x04,

  /* we received a direct message from another node
   *
   * [0x05, msgpack(
   *   array[
   *     (binary), // from address
   *     (binary), // message data
   *   ]
   * )]
   */
  RECV_SEND: 0x05,

  /* we received a "call" request from another node
   *
   * [0x06, msgpack(
   *   array[
   *     (binary), // remote message identifier
   *     (binary), // from address
   *     (binary), // message data
   *   ]
   * )]
   */
  RECV_CALL: 0x06,

  /* we received a "call" response from another node to a call we made
   *
   * [0x07, msgpack(
   *   array[
   *     (binary), // remote message identifier
   *     (binary), // from address
   *     (binary), // message data
   *   ]
   * )]
   */
  RECV_CALL_RESP: 0x07
}
