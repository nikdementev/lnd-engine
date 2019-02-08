const {
  listChannels,
  listClosedChannels
} = require('../lnd-actions')
const { networkAddressFormatter } = require('../utils')

/**
 * @typedef {NormalizedChannel}
 * @type {object}
 * @property {string}  chanId            Unique ID of the channel
 * @property {string}  remoteAddress     Payment Channel Network address of the peer with whom the channel exists
 * @property {string}  openTransaction   Transaction that represents the opening of the channel
 * @property {string}  closeTransaction  Transaction that closed the channel (if it is closed)
 * @property {boolean} active            Whether the channel is currently active
 * @property {string}  capacity          Total capacity of the channel
 */

/**
 * Convert a channel from a returned value from LND into
 * a standard format.
 * @external Channel
 * @see {@link https://api.lightning.community/#channel}
 * @param {Channel} channel channel object from LND
 * @return {NormalizedChannel} Channel with standard field names
 */
function normalizeChannel (channel) {
  return {
    chanId: channel.chanId,
    active: channel.active,
    remoteAddress: networkAddressFormatter.serialize({ publicKey: channel.remotePubkey }),
    openTransaction: channel.channelPoint,
    closeTransaction: channel.closingTxHash,
    capacity: channel.capacity
  }
}

/**
 * Normalize an array of LND channels
 * @param  {Array<Channel>} channels Array of channels returned from LND
 * @return {Map<string, NormalizedChannel>} Map of normalized channels keyed by their ID
 */
function normalizeChannels (channels) {
  return channels.reduce((map, channel) => {
    map.set(channel.chanId, normalizeChannel(channel))
    return map
  }, new Map())
}

/**
 * Get all open channels
 * @param {object} options
 * @param {object} options.client
 * @return {Map<string, NormalizedChannel>} Map of channels by channel ID
 */
async function getOpenChannels ({ client }) {
  const { channels } = await listChannels({ client })

  return normalizeChannels(channels)
}

/**
 * Get all closed channels
 * @param {object} options
 * @param {object} options.client
 * @return {Map<string, NormalizedChannel>} Map of channels by channel ID
 */
async function getClosedChannels ({ client }) {
  const { channels } = await listClosedChannels({ client })

  return normalizeChannels(channels)
}

/**
 * Returns all channels, both open and closed (but not pending)
 * @return {Array<NormalizedChannel>} 
 */
async function getChannels () {
  const { client } = this

  const [
    openChannels,
    closedChannels
  ] = await Promise.all([
    getOpenChannels({ client }),
    getClosedChannels({ client })
  ])

  // merge open and closed channels, with closed channels overwriting
  // open ones since they contain more data (close transactions)
  const channels = new Map([...openChannels, ...closedChannels])
}

module.exports = getChannels
