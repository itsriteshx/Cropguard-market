const io = require('socket.io-client');

const runSocketVerification = async () => {
  console.log('--- Testing Socket.io Negotiation Gateway ---');

  // Step 1: Login Farmer
  const farmerLoginRes = await fetch('http://localhost:5001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '9876543210', password: 'farmerpassword123' })
  });
  const farmerAuth = await farmerLoginRes.json();
  const farmerToken = farmerAuth.token;
  const farmerId = farmerAuth.user._id;

  // Step 2: Create a fresh Produce Listing for this test
  const listingRes = await fetch('http://localhost:5001/api/listings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${farmerToken}`
    },
    body: JSON.stringify({
      cropName: 'Nashik Red Onion',
      category: 'VEGETABLES',
      quantity: 500,
      unit: 'KG',
      pricePerUnit: 28,
      qualityGrade: 'GRADE_A',
      description: 'Freshly harvested Nashik red onions'
    })
  });
  const listingData = await listingRes.json();
  const listingId = listingData.listing._id;
  console.log(`✅ Created Test Listing: ${listingId} (Nashik Red Onion)`);

  // Step 3: Login Buyer
  const buyerLoginRes = await fetch('http://localhost:5001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '9811223344', password: 'buyerpassword123' })
  });
  const buyerAuth = await buyerLoginRes.json();
  const buyerToken = buyerAuth.token;
  const buyerId = buyerAuth.user._id;

  // Step 4: Buyer starts negotiation
  const negRes = await fetch('http://localhost:5001/api/negotiations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${buyerToken}`
    },
    body: JSON.stringify({
      listingId,
      offeredPrice: 22,
      quantity: 100,
      note: 'Opening bid of ₹22/kg'
    })
  });
  const negData = await negRes.json();
  const negotiationId = negData.negotiation._id;
  console.log(`✅ Created Negotiation Session: ${negotiationId}`);

  // Step 5: Test Real-Time WebSocket Layer
  const socketUrl = 'http://localhost:5001/negotiation';

  const farmerSocket = io(socketUrl, {
    transports: ['websocket'],
    autoConnect: false
  });

  const buyerSocket = io(socketUrl, {
    transports: ['websocket'],
    autoConnect: false
  });

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      farmerSocket.disconnect();
      buyerSocket.disconnect();
      reject(new Error('WebSocket verification timed out after 10s'));
    }, 10000);

    farmerSocket.on('connect', () => {
      console.log('✅ Farmer Socket connected to /negotiation namespace');
      farmerSocket.emit('join_room', {
        negotiationId,
        userId: farmerId,
        userRole: 'FARMER'
      });
    });

    farmerSocket.on('room_joined', (data) => {
      console.log('✅ Farmer confirmed in room:', data.room);
      buyerSocket.connect();
    });

    buyerSocket.on('connect', () => {
      console.log('✅ Buyer Socket connected to /negotiation namespace');
      buyerSocket.emit('join_room', {
        negotiationId,
        userId: buyerId,
        userRole: 'BUYER'
      });
    });

    buyerSocket.on('room_joined', () => {
      console.log('✅ Buyer confirmed in room. Submitting live counter-offer: ₹24/kg...');
      buyerSocket.emit('send_counter_offer', {
        negotiationId,
        bidderId: buyerId,
        bidderRole: 'BUYER',
        pricePerUnit: 24,
        note: 'Live WebSocket test bid'
      });
    });

    farmerSocket.on('counter_offer_received', (data) => {
      console.log('✅ Farmer received live counter_offer_received broadcast:', {
        price: data.currentOfferedPrice,
        turn: data.currentTurn,
        status: data.status
      });

      console.log('Farmer accepting deal via WebSocket...');
      farmerSocket.emit('accept_deal', {
        negotiationId,
        userId: farmerId,
        userRole: 'FARMER'
      });
    });

    buyerSocket.on('deal_locked', (data) => {
      console.log('🎉 Buyer received deal_locked broadcast:', {
        crop: data.dealSummary.crop,
        agreedPrice: data.dealSummary.agreedPricePerUnit,
        total: data.dealSummary.agreedTotalAmount,
        status: data.dealSummary.status
      });

      clearTimeout(timeout);
      farmerSocket.disconnect();
      buyerSocket.disconnect();
      resolve();
    });

    farmerSocket.on('error', (err) => console.error('Farmer socket error:', err));
    buyerSocket.on('error', (err) => console.error('Buyer socket error:', err));

    // Connect farmer socket to initiate flow
    farmerSocket.connect();
  });
};

runSocketVerification()
  .then(() => {
    console.log('--- ALL WEBSOCKET TESTS PASSED SUCCESSFULLY! ---');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Socket test error:', err.message);
    process.exit(1);
  });
