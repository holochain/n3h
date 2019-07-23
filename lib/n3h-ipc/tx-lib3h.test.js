const txLib3h = require('./tx-lib3h')

const ALL = [
  {
    'lib3h_client_protocol': 'SuccessResult',
    'request_id': 'rid',
    'space_address': 'adr',
    'to_agent_id': 'aid',
    'result_info': 'eW8='
  },
  {
    'lib3h_client_protocol': 'FailureResult',
    'request_id': 'rid',
    'space_address': 'adr',
    'to_agent_id': 'aid',
    'result_info': 'eW8='
  },
  {
    'lib3h_client_protocol': 'Connect',
    'request_id': 'rid',
    'peer_uri': 'hc:id',
    'network_id': 'nid'
  },
  {
    'lib3h_client_protocol': 'JoinSpace',
    'request_id': 'rid',
    'space_address': 'adr',
    'agent_id': 'aid'
  },
  {
    'lib3h_client_protocol': 'LeaveSpace',
    'request_id': 'rid',
    'space_address': 'adr',
    'agent_id': 'aid'
  },
  {
    'lib3h_client_protocol': 'SendDirectMessage',
    'space_address': 'adr',
    'request_id': 'rid',
    'to_agent_id': 'aid',
    'from_agent_id': 'aid',
    'content': 'eW8='
  },
  {
    'lib3h_client_protocol': 'HandleSendDirectMessageResult',
    'space_address': 'adr',
    'request_id': 'rid',
    'to_agent_id': 'aid',
    'from_agent_id': 'aid',
    'content': 'eW8='
  },
  {
    'lib3h_client_protocol': 'FetchEntry',
    'space_address': 'adr',
    'entry_address': 'adr',
    'request_id': 'rid',
    'provider_agent_id': 'aid',
    'aspect_address_list': [
      'adr'
    ]
  },
  {
    'lib3h_client_protocol': 'HandleFetchEntryResult',
    'space_address': 'adr',
    'provider_agent_id': 'aid',
    'request_id': 'rid',
    'entry': {
      'entry_address': 'adr',
      'aspect_list': [
        {
          'aspect_address': 'adr',
          'type_hint': 'hint',
          'aspect': 'eW8=',
          'publish_ts': 42
        }
      ]
    }
  },
  {
    'lib3h_client_protocol': 'PublishEntry',
    'space_address': 'adr',
    'provider_agent_id': 'aid',
    'entry': {
      'entry_address': 'adr',
      'aspect_list': [
        {
          'aspect_address': 'adr',
          'type_hint': 'hint',
          'aspect': 'eW8=',
          'publish_ts': 42
        }
      ]
    }
  },
  {
    'lib3h_client_protocol': 'HoldEntry',
    'space_address': 'adr',
    'provider_agent_id': 'aid',
    'entry': {
      'entry_address': 'adr',
      'aspect_list': [
        {
          'aspect_address': 'adr',
          'type_hint': 'hint',
          'aspect': 'eW8=',
          'publish_ts': 42
        }
      ]
    }
  },
  {
    'lib3h_client_protocol': 'QueryEntry',
    'space_address': 'adr',
    'entry_address': 'adr',
    'request_id': 'rid',
    'requester_agent_id': 'aid',
    'query': 'eW8='
  },
  {
    'lib3h_client_protocol': 'HandleQueryEntryResult',
    'space_address': 'adr',
    'entry_address': 'adr',
    'request_id': 'rid',
    'requester_agent_id': 'aid',
    'responder_agent_id': 'aid',
    'query_result': 'eW8='
  },
  {
    'lib3h_client_protocol': 'HandleGetAuthoringEntryListResult',
    'space_address': 'adr',
    'provider_agent_id': 'aid',
    'request_id': 'rid',
    'address_map': {
      'adr': [
        'adr'
      ]
    }
  },
  {
    'lib3h_client_protocol': 'HandleGetGossipingEntryListResult',
    'space_address': 'adr',
    'provider_agent_id': 'aid',
    'request_id': 'rid',
    'address_map': {
      'adr': [
        'adr'
      ]
    }
  },
  {
    'lib3h_client_protocol': 'Shutdown'
  },
  {
    'lib3h_server_protocol': 'SuccessResult',
    'request_id': 'rid',
    'space_address': 'adr',
    'to_agent_id': 'aid',
    'result_info': 'eW8='
  },
  {
    'lib3h_server_protocol': 'FailureResult',
    'request_id': 'rid',
    'space_address': 'adr',
    'to_agent_id': 'aid',
    'result_info': 'eW8='
  },
  {
    'lib3h_server_protocol': 'Connected',
    'request_id': 'rid',
    'uri': 'hc:id'
  },
  {
    'lib3h_server_protocol': 'Disconnected',
    'network_id': 'nid'
  },
  {
    'lib3h_server_protocol': 'SendDirectMessageResult',
    'space_address': 'adr',
    'request_id': 'rid',
    'to_agent_id': 'aid',
    'from_agent_id': 'aid',
    'content': 'eW8='
  },
  {
    'lib3h_server_protocol': 'HandleSendDirectMessage',
    'space_address': 'adr',
    'request_id': 'rid',
    'to_agent_id': 'aid',
    'from_agent_id': 'aid',
    'content': 'eW8='
  },
  {
    'lib3h_server_protocol': 'FetchEntryResult',
    'space_address': 'adr',
    'provider_agent_id': 'aid',
    'request_id': 'rid',
    'entry': {
      'entry_address': 'adr',
      'aspect_list': [
        {
          'aspect_address': 'adr',
          'type_hint': 'hint',
          'aspect': 'eW8=',
          'publish_ts': 42
        }
      ]
    }
  },
  {
    'lib3h_server_protocol': 'HandleFetchEntry',
    'space_address': 'adr',
    'entry_address': 'adr',
    'request_id': 'rid',
    'provider_agent_id': 'aid',
    'aspect_address_list': [
      'adr'
    ]
  },
  {
    'lib3h_server_protocol': 'HandleStoreEntryAspect',
    'request_id': 'rid',
    'space_address': 'adr',
    'provider_agent_id': 'aid',
    'entry_address': 'adr',
    'entry_aspect': {
      'aspect_address': 'adr',
      'type_hint': 'hint',
      'aspect': 'eW8=',
      'publish_ts': 42
    }
  },
  {
    'lib3h_server_protocol': 'HandleDropEntry',
    'space_address': 'adr',
    'request_id': 'rid',
    'entry_address': 'adr'
  },
  {
    'lib3h_server_protocol': 'HandleQueryEntry',
    'space_address': 'adr',
    'entry_address': 'adr',
    'request_id': 'rid',
    'requester_agent_id': 'aid',
    'query': 'eW8='
  },
  {
    'lib3h_server_protocol': 'QueryEntryResult',
    'space_address': 'adr',
    'entry_address': 'adr',
    'request_id': 'rid',
    'requester_agent_id': 'aid',
    'responder_agent_id': 'aid',
    'query_result': 'eW8='
  },
  {
    'lib3h_server_protocol': 'HandleGetAuthoringEntryList',
    'space_address': 'adr',
    'provider_agent_id': 'aid',
    'request_id': 'rid'
  },
  {
    'lib3h_server_protocol': 'HandleGetGossipingEntryList',
    'space_address': 'adr',
    'provider_agent_id': 'aid',
    'request_id': 'rid'
  },
  {
    'lib3h_server_protocol': 'Terminated'
  },
  {
    'lib3h_server_protocol': 'P2pReady'
  }
]

describe('tx-lib3h Suite', () => {
  it('full suite', () => {
    for (let j of ALL) {
      const jj = JSON.stringify(j, null, 2)
      console.log(jj)
      const t = txLib3h.fromLib3h(j)
      const tt = JSON.stringify(t, null, 2)
      console.log(tt)
      const jj2 = JSON.stringify(txLib3h.toLib3h(t), null, 2)
      console.log(jj2)
      if (jj2 !== jj) {
        throw new Error('bad tx')
      }
    }
  })
})
