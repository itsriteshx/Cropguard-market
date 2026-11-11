const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { Server } = require('socket.io');
const { io: connect } = require('socket.io-client');
const jwt = require('jsonwebtoken');
const User = require('../src/models/User');
const Negotiation = require('../src/models/Negotiation');
const initSocket = require('../src/sockets/negotiationSocket');

const waitFor = (socket, name) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${name}`)), 3000);
  socket.once(name, (value) => { clearTimeout(timer); resolve(value); });
});

test('socket requires authentication and allows only participants to join', async () => {
  const originalUser = User.findById, originalNegotiation = Negotiation.findById;
  const server = http.createServer();
  const io = new Server(server);
  const clients = [];
  try {
    User.findById = (id) => ({ select: async () => ({ _id: id, role: 'BUYER_RETAIL' }) });
    Negotiation.findById = () => ({ select: async () => ({ _id: 'room1', buyer: 'buyer', farmer: 'farmer' }) });
    initSocket(io);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${server.address().port}/negotiation`;
    const makeClient = (id) => {
      const token = id && jwt.sign({ id }, process.env.JWT_SECRET || 'cropguard_dev_secret_key_adypu_2026');
      const client = connect(url, { autoConnect: false, reconnection: false, auth: token ? { token } : {} });
      clients.push(client); return client;
    };
    const anonymous = makeClient();
    const denied = waitFor(anonymous, 'connect_error'); anonymous.connect();
    assert.match((await denied).message, /Unauthorized/);
    const outsider = makeClient('outsider');
    const connected = waitFor(outsider, 'connect'); outsider.connect(); await connected;
    const error = waitFor(outsider, 'error'); outsider.emit('join_room', { negotiationId: 'room1', userId: 'buyer' });
    assert.match((await error).message, /Not authorized/);
    const buyer = makeClient('buyer');
    const buyerConnected = waitFor(buyer, 'connect'); buyer.connect(); await buyerConnected;
    const joined = waitFor(buyer, 'room_joined'); buyer.emit('join_room', { negotiationId: 'room1' });
    assert.equal((await joined).room, 'room_room1');
    assert.equal(io.of('/negotiation').sockets.get(buyer.id).rooms.has('room_room1'), true);
    assert.equal(io.of('/negotiation').sockets.get(outsider.id).rooms.has('room_room1'), false);
  } finally {
    clients.forEach((client) => client.disconnect());
    await new Promise((resolve) => io.close(resolve));
    User.findById = originalUser; Negotiation.findById = originalNegotiation;
  }
});

test('socket typing lifecycle: validates room membership and cleans up on stop and disconnect', async () => {
  const originalUser = User.findById, originalNegotiation = Negotiation.findById;
  const server = http.createServer();
  const io = new Server(server);
  const clients = [];

  try {
    User.findById = (id) => ({
      select: async () => ({ _id: id, role: id === 'farmer1' ? 'FARMER' : 'BUYER_RETAIL' })
    });
    Negotiation.findById = () => ({
      select: async () => ({ _id: 'neg_123', buyer: 'buyer1', farmer: 'farmer1' })
    });
    initSocket(io);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${server.address().port}/negotiation`;

    const makeClient = (id) => {
      const token = jwt.sign({ id }, process.env.JWT_SECRET || 'cropguard_dev_secret_key_adypu_2026');
      const client = connect(url, { autoConnect: false, reconnection: false, auth: { token } });
      clients.push(client);
      return client;
    };

    const buyer = makeClient('buyer1');
    const farmer = makeClient('farmer1');
    const outsider = makeClient('outsider99');

    await Promise.all([
      new Promise((res) => { buyer.once('connect', res); buyer.connect(); }),
      new Promise((res) => { farmer.once('connect', res); farmer.connect(); }),
      new Promise((res) => { outsider.once('connect', res); outsider.connect(); })
    ]);

    // Authorized participants join
    const buyerJoined = waitFor(buyer, 'room_joined');
    buyer.emit('join_room', { negotiationId: 'neg_123' });
    await buyerJoined;

    const farmerJoined = waitFor(farmer, 'room_joined');
    farmer.emit('join_room', { negotiationId: 'neg_123' });
    await farmerJoined;

    // 1. Outsider attempts typing in unjoined room: must NOT broadcast to participants
    let outsiderTypingReceived = false;
    farmer.on('participant_typing', () => { outsiderTypingReceived = true; });
    outsider.emit('typing_start', { negotiationId: 'neg_123' });
    await new Promise((r) => setTimeout(r, 60));
    assert.equal(outsiderTypingReceived, false, 'Unjoined socket must not broadcast typing');

    // 2. Authorized buyer starts typing: farmer receives typing_start notification
    const typingStartedPromise = waitFor(farmer, 'participant_typing');
    buyer.emit('typing_start', { negotiationId: 'neg_123' });
    const typingStartPayload = await typingStartedPromise;
    assert.equal(typingStartPayload.negotiationId, 'neg_123');
    assert.equal(typingStartPayload.userId, 'buyer1');
    assert.equal(typingStartPayload.isTyping, true);

    // 3. Authorized buyer stops typing: farmer receives typing_stop notification
    const typingStoppedPromise = waitFor(farmer, 'participant_typing');
    buyer.emit('typing_stop', { negotiationId: 'neg_123' });
    const typingStopPayload = await typingStoppedPromise;
    assert.equal(typingStopPayload.isTyping, false);

    // 4. Disconnect cleanup: buyer starts typing, then disconnects
    const typingAgainPromise = waitFor(farmer, 'participant_typing');
    buyer.emit('typing_start', { negotiationId: 'neg_123' });
    await typingAgainPromise;

    const disconnectCleanupPromise = waitFor(farmer, 'participant_typing');
    buyer.disconnect();
    const disconnectCleanupPayload = await disconnectCleanupPromise;
    assert.equal(disconnectCleanupPayload.isTyping, false, 'Disconnect must emit typing stop to room');
  } finally {
    clients.forEach((client) => client.disconnect());
    await new Promise((resolve) => io.close(resolve));
    User.findById = originalUser;
    Negotiation.findById = originalNegotiation;
  }
});
