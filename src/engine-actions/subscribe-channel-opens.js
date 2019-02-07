const EventEmitter = require('events')
const { listChannels } = require('../lnd-actions')
const { networkAddressFormatter } = require('../utils')

/**
 * Interval between polls, in milliseconds
 * @constant
 * @type {Number}
 */
const INTERVAL = 5000

/**
 * Convert a channel from a returned value from LND into
 * a standard format.
 * @external Channel
 * @see {@link https://api.lightning.community/#channel}
 * @param {object} channel channel object from LND
 * @return {object} Channel with standard field names
 */
function normalizeChannel (channel) {
  return {
    chanId: channel.chanId,
    active: channel.active,
    remoteAddress: networkAddressFormatter.serialize({ publicKey: channel.remotePubkey }),
    transaction: channel.channelPoint,
    localBalance: channel.localBalance,
    remoteBalance: channel.remoteBalance
  }
}

/**
 * Get all open channels
 * @param {object} options
 * @param {object} options.client
 * @return {Map} Map of channels by channel ID
 */
async function getOpenChannels ({ client }) {
  const { channels } = await listChannels({ client })

  return channels.reduce((map, channel) => {
    map.set(channel.chanId, normalizeChannel(channel))
    return map
  }, new Map())
}

/**
 * Compare a set of old channels against a new set and find the new
 * channels not in the old set
 * @param {Map} oldChannels Channels that we know of
 * @param {object} options
 * @param {object} options.client
 * @return {Map} Channels just returned from LND
 */
async function getNewChannels (oldChannels, { client }) {
  const channels = await getOpenChannels({ client })
  const newChannels = new Map()

  for (var chanId of channels.keys()) {
    if (!oldChannels.has(chanId)) {
      newChannels.set(chanId, channels.get(chanId))
    }
  }

  return newChannels
}

/**
 * Listen for new channel openings
 * Note: this is implemented as a poller because LND < 0.6 does not have a SubscribeChannels
 * rpc. Once SubscribeChannels is implemented, this implementation should be replaced.
 * @param {EventEmitter} emitter Event emitter that will emit when new channels are found. Not intended for consumer use.
 * @param {Map} channels Channels that we know of ahead of time. Not intended for consumer use.
 * @return {EventEmitter} EventEmitter that emits events on changes to channel state
 */
function subscribeChannelOpens (emitter = new EventEmitter(), channels = new Map()) {
  const { client } = this

  setTimeout(async () => {
    const newChannels = await getNewChannels(channels, { client })

    for (var channel of newChannels.values()) {
      emitter.emit('open', channel)
    }

    channels = new Map([...channels, ...newChannels])

    // reset our timer by calling the outer function again
    subscribeChannelOpens.call(this, emitter, channels)
  }, INTERVAL)

  return emitter
}

module.exports = subscribeChannelOpens
