/*!
 * n3h IPC constants and message descriptions
 */

/// ipc server magic identifier
exports.SRV_ID = Buffer.from([0x24, 0x24, 0x24, 0x24])

/// these message types are sent out by clients to the p2p IPC socket
exports.Message = {
  /* client initiated heartbeat
   *
   * [0x10, msgpack(
   *   array[
   *     (int) // start-time millis epoch timestamp
   *   ]
   * )]
   */
  PING: 0x10,

  /* response to client initiated heartbeat
   *
   * [0x11, msgpack(
   *   array[
   *     (int), // start-time millis epoch timestamp
   *     (int), // server response time millis epoch timestamp
   *   ]
   * )]
   */
  PONG: 0x11,

  /* send a message to either side, await a response
   *
   * [0x20, msgpack(
   *   array[
   *     (binary), // message identifier
   *     (binary), // message data
   *   ]
   * )]
   */
  CALL: 0x20,

  /* success response to a call
   *
   * [0x21, msgpack(
   *   array[
   *     (binary), // message identifier
   *     (binary), // message data
   *   ]
   * )]
   */
  CALL_OK: 0x21,

  /* server was un-able to process the request
   *
   * [0x22, msgpack(
   *   array[
   *     (binary), // message identifier
   *     (string), // error message
   *   ]
   * )]
   */
  CALL_FAIL: 0x22
}
