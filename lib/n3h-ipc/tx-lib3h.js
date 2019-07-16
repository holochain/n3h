
function fromLib3hName (n) {
  switch (n) {
    case 'SuccessResult':
      return 'successResult'
    case 'FailureResult':
      return 'failureResult'
    case 'Connect':
      return 'connect'
    case 'JoinSpace':
      return 'trackDna'
    case 'LeaveSpace':
      return 'untrackDna'
    case 'SendDirectMessage':
      return 'sendMessage'
    case 'HandleSendDirectMessageResult':
      return 'handleSendMessageResult'
    case 'FetchEntry':
      return 'fetchEntry'
    case 'HandleFetchEntryResult':
      return 'handleFetchEntryResult'
    case 'PublishEntry':
      return 'publishEntry'
    case 'HoldEntry':
      return 'holdEntry'
    case 'QueryEntry':
      return 'queryEntry'
    case 'HandleQueryEntryResult':
      return 'handleQueryEntryResult'
    case 'HandleGetAuthoringEntryListResult':
      return 'handleGetAuthoringEntryListResult'
    case 'HandleGetGossipingEntryListResult':
      return 'handleGetGossipingEntryListResult'
    case 'Shutdown':
      return 'shutdown'
    case 'Connected':
      return 'peerConnected'
    case 'Disconnected':
      return 'disconnected'
    case 'SendDirectMessageResult':
      return 'sendMessageResult'
    case 'HandleSendDirectMessage':
      return 'handleSendMessage'
    case 'FetchEntryResult':
      return 'fetchEntryResult'
    case 'HandleFetchEntry':
      return 'handleFetchEntry'
    case 'HandleStoreEntryAspect':
      return 'handleStoreEntryAspect'
    case 'HandleDropEntry':
      return 'handleDropEntry'
    case 'HandleQueryEntry':
      return 'handleQueryEntry'
    case 'QueryEntryResult':
      return 'queryEntryResult'
    case 'HandleGetAuthoringEntryList':
      return 'handleGetAuthoringEntryList'
    case 'HandleGetGossipingEntryList':
      return 'handleGetGossipingEntryList'
    case 'Terminated':
      return 'terminated'
    case 'P2pReady':
      return 'p2pReady'
    default:
      throw new Error('unhandled: ' + n)
  }
}

function fromLib3hObj (o) {
  const out = {}
  for (let k in o) {
    switch (k) {
      case 'lib3h_client_protocol':
        out['method'] = fromLib3hName(o[k])
        out['methodType'] = 'client'
        break
      case 'lib3h_server_protocol':
        out['method'] = fromLib3hName(o[k])
        out['methodType'] = 'server'
        break
      case 'request_id':
        out['_id'] = o[k]
        break
      case 'space_address':
        out['dnaAddress'] = o[k]
        break
      case 'to_agent_id':
        out['toAgentId'] = o[k]
        break
      case 'result_info':
        out['resultInfo'] = o[k]
        break
      case 'peer_uri':
        out['peerAddress'] = o[k]
        break
      case 'network_id':
        out['network_id'] = o[k]
        break
      case 'agent_id':
        out['agentId'] = o[k]
        break
      case 'to_agent_id':
        out['toAgentId'] = o[k]
        break
      case 'from_agent_id':
        out['fromAgentId'] = o[k]
        break
      case 'provider_agent_id':
        out['providerAgentId'] = o[k]
        break
      case 'requester_agent_id':
        out['requesterAgentId'] = o[k]
        break
      case 'responder_agent_id':
        out['responderAgentId'] = o[k]
        break
      case 'content':
        out['content'] = o[k]
        break
      case 'query':
        out['query'] = o[k]
        break
      case 'query_result':
        out['query_result'] = o[k]
        break
      case 'entry_address':
        out['entryAddress'] = o[k]
        break
      case 'aspect_address_list':
        out['aspectAddressList'] = o[k].slice(0)
        break
      case 'entry':
        out['entryAddress'] = o[k].entry_address
        out['aspectList'] = fromLib3hAspectList(o[k].aspect_list)
        break
      case 'entry_aspect':
        out['entryAspect'] = {
          aspectAddress: o[k].aspect_address,
          typeHint: o[k].type_hint,
          aspect: o[k].aspect,
          publishTs: o[k].publish_ts
        }
        break
      case 'address_map':
        out['addressMap'] = o[k]
        break
      case 'uri':
        out['uri'] = o[k]
        break
      default:
        throw new Error('unhandled: ' + k)
    }
  }
  return out
}

function fromLib3hAspectList (l) {
  return l.map(a => {
    return {
      aspectAddress: a.aspect_address,
      typeHint: a.type_hint,
      aspect: a.aspect,
      publishTs: a.publish_ts
    }
  })
}

function fromLib3h (j) {
  return fromLib3hObj(j)
}

exports.fromLib3h = fromLib3h

function toLib3hName (out, o) {
  const name = o.methodType === 'client'
    ? 'lib3h_client_protocol'
    : 'lib3h_server_protocol'
  switch (o.method) {
    case 'successResult':
      out[name] = 'SuccessResult'
      break
    case 'failureResult':
      out[name] = 'FailureResult'
      break
    case 'connect':
      out[name] = 'Connect'
      break
    case 'trackDna':
      out[name] = 'JoinSpace'
      break
    case 'untrackDna':
      out[name] = 'LeaveSpace'
      break
    case 'sendMessage':
      out[name] = 'SendDirectMessage'
      break
    case 'handleSendMessageResult':
      out[name] = 'HandleSendDirectMessageResult'
      break
    case 'fetchEntry':
      out[name] = 'FetchEntry'
      break
    case 'handleFetchEntryResult':
      out[name] = 'HandleFetchEntryResult'
      toLib3hAspectList(out, o)
      break
    case 'publishEntry':
      out[name] = 'PublishEntry'
      toLib3hAspectList(out, o)
      delete out.request_id
      break
    case 'holdEntry':
      out[name] = 'HoldEntry'
      toLib3hAspectList(out, o)
      delete out.request_id
      break
    case 'handleStoreEntryAspect':
      out[name] = 'HandleStoreEntryAspect'
      break
    case 'queryEntry':
      out[name] = 'QueryEntry'
      break
    case 'handleQueryEntryResult':
      out[name] = 'HandleQueryEntryResult'
      break
    case 'handleGetAuthoringEntryListResult':
      out[name] = 'HandleGetAuthoringEntryListResult'
      break
    case 'handleGetGossipingEntryListResult':
      out[name] = 'HandleGetGossipingEntryListResult'
      break
    case 'shutdown':
      out[name] = 'Shutdown'
      break
    case 'peerConnected':
      out[name] = 'Connected'
      break
    case 'disconnected':
      out[name] = 'Disconnected'
      break
    case 'sendMessageResult':
      out[name] = 'SendDirectMessageResult'
      break
    case 'handleSendMessage':
      out[name] = 'HandleSendDirectMessage'
      break
    case 'handleFetchEntry':
      out[name] = 'HandleFetchEntry'
      break
    case 'fetchEntryResult':
      out[name] = 'FetchEntryResult'
      toLib3hAspectList(out, o)
      break
    case 'handleDropEntry':
      out[name] = 'HandleDropEntry'
      break
    case 'handleQueryEntry':
      out[name] = 'HandleQueryEntry'
      break
    case 'queryEntryResult':
      out[name] = 'QueryEntryResult'
      break
    case 'handleGetAuthoringEntryList':
      out[name] = 'HandleGetAuthoringEntryList'
      break
    case 'handleGetGossipingEntryList':
      out[name] = 'HandleGetGossipingEntryList'
      break
    case 'terminated':
      out[name] = 'Terminated'
      break
    case 'p2pReady':
      out[name] = 'P2pReady'
      break
    default:
      throw new Error('unhandled: ' + o.method)
  }
}

function toLib3hAspectList (out, o) {
  out.space_address = ''
  out.provider_agent_id = ''
  out.request_id = ''
  out.entry = {
    entry_address: o.entryAddress,
    aspect_list: o.aspectList.map(a => {
      return {
        aspect_address: a.aspectAddress,
        type_hint: a.typeHint,
        aspect: a.aspect,
        publish_ts: a.publishTs
      }
    })
  }
  delete o.entryAddress
  delete o.aspectList
}

function toLib3hObj (o) {
  const out = {}
  for (let k in o) {
    switch (k) {
      case 'method':
        toLib3hName(out, o)
        break
      case 'methodType':
        break
      case '_id':
        out['request_id'] = o[k]
        break
      case 'dnaAddress':
        out['space_address'] = o[k]
        break
      case 'toAgentId':
        out['to_agent_id'] = o[k]
        break
      case 'resultInfo':
        out['result_info'] = o[k]
        break
      case 'peerAddress':
        out['peer_uri'] = o[k]
        break
      case 'network_id':
        out['network_id'] = o[k]
        break
      case 'agentId':
        out['agent_id'] = o[k]
        break
      case 'toAgentId':
        out['to_agent_id'] = o[k]
        break
      case 'fromAgentId':
        out['from_agent_id'] = o[k]
        break
      case 'providerAgentId':
        out['provider_agent_id'] = o[k]
        break
      case 'requesterAgentId':
        out['requester_agent_id'] = o[k]
        break
      case 'responderAgentId':
        out['responder_agent_id'] = o[k]
        break
      case 'content':
        out['content'] = o[k]
        break
      case 'query':
        out['query'] = o[k]
        break
      case 'query_result':
        out['query_result'] = o[k]
        break
      case 'entryAddress':
        out['entry_address'] = o[k]
        break
      case 'aspectAddressList':
        out['aspect_address_list'] = o[k].slice(0)
        break
      case 'addressMap':
        out['address_map'] = o[k]
        break
      case 'entryAspect':
        out['entry_aspect'] = {
          aspect_address: o[k].aspectAddress,
          type_hint: o[k].typeHint,
          aspect: o[k].aspect,
          publish_ts: o[k].publishTs
        }
        break
      case 'uri':
        out['uri'] = o[k]
        break
      default:
        throw new Error('unhandled: ' + k)
    }
  }
  return out
}

function toLib3h (t) {
  return toLib3hObj(t)
}

exports.toLib3h = toLib3h
