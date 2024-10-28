import * as dotenv from 'dotenv'
dotenv.config()
import { v4 as uuidv4 } from 'uuid'
import _ from 'lodash'

import {
  fetchAccessToken,
  openWebSocketConnection,
  validateClientIdAndClientSecret,
} from '../../common/koneapi'

/**
 * Update these two variables with your own credentials or set them up as environment variables.
 */
const CLIENT_ID: string = process.env.CLIENT_ID || 'YOUR_CLIENT_ID' // eg. 'dcf48ab0-a902-4b52-8c53-1a9aede716e5'
const CLIENT_SECRET: string = process.env.CLIENT_SECRET || 'YOUR_CLIENT_SECRET' // eg. '31d1329f8344fc12b1a960c8b8e0fc6a22ea7c35774c807a4fcabec4ffc8ae5b'
const BUILDING_ID: string = process.env.BUILDING_ID || ''

let webSocketConnection: any
let targetBuildingId: string
/**
 * Function is used to log out incoming WebSocket messages
 *
 * @param {string} data data string from WebSocket
 */
const onWebSocketMessage = (data: string): void => {
  let dataBlob = JSON.parse(data)

  console.log('Incoming WebSocket message', dataBlob)
  if (dataBlob.data.session_id) {
    console.log(`Making monitoring request ${dataBlob.data.session_id}`)
    activateMonitoring(dataBlob.data.session_id)
  }
  console.log('timing ' + new Date())
}

function activateMonitoring(session_id: number) {
  // Build the call payload using the areas previously generated
  const monitoringCallPayload: any = {
    type: 'site-monitoring',
    requestId: uuidv4(),
    buildingId: targetBuildingId,
    callType: 'monitor',
    // callType: 'config',
    groupId: '1',
    payload: {
      sub: 'KCESmartLiftClient2',
      duration: 300,
      subtopics: [
        `call_state/${session_id}/being_allocated`,
        `call_state/${session_id}/being_served`,
        `call_state/${session_id}/served_soon`,
        `call_state/${session_id}/served`
      ],
    },
  }

  console.log('monitoring request payload')
  console.log(JSON.stringify(monitoringCallPayload))
  webSocketConnection.send(JSON.stringify(monitoringCallPayload))
}
/**
 * Main function that starts the script execution
 */
const start = async () => {
  validateClientIdAndClientSecret(CLIENT_ID, CLIENT_SECRET)

  // Fetch the access token with both application/inventory scope and access to execute elevator calls on any building
  // accessible to the application - note that if you have many (100+) resources, you cannot use wildcards
  let accessToken = await fetchAccessToken(CLIENT_ID, CLIENT_SECRET, [
    'application/inventory',
    `callgiving/group:${BUILDING_ID}:1`,
  ])
  console.log('AccessToken successfully fetched')

  // Select the first available building
  targetBuildingId = `building:${BUILDING_ID}`
  // Fetch the topology of the specific building

  // Open the WebSocket connection
  webSocketConnection = await openWebSocketConnection(accessToken)
  console.log('WebSocket open ' + new Date())

  // Add handler for incoming messages
  webSocketConnection.on('message', (data: any) => onWebSocketMessage(data))

  const destinationCallPayload: any = {
    type: 'lift-call-api-v2',
    buildingId: targetBuildingId,
    callType: 'action',
    groupId: '1',
    payload: {
      request_id: getRequestId(),
      area: 3000,
      time: '2020-10-10T07:17:33.298515Z',
      terminal: 1,
      // action 2 is for DCS call
      call: { action: 2, destination: 5000 },
    },
  }

  console.log(destinationCallPayload)
  // execute the call within the open WebSocket connection
  webSocketConnection.send(JSON.stringify(destinationCallPayload))
}

function getRequestId() {
  return Math.floor(Math.random() * 1000000000)
}
start()
