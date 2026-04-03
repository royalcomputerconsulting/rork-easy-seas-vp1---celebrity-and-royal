const BACKEND_URL = "https://rork-easy-seas-vp1-2nep.onrender.com";
const TEST_EMAIL = `backend-test-${Date.now()}@easyseas.app`;

async function callTrpcQuery(path, input) {
  const encodedInput = encodeURIComponent(JSON.stringify({ json: input }));
  const response = await fetch(`${BACKEND_URL}/trpc/${path}?input=${encodedInput}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  const rawText = await response.text();
  let parsed = null;

  try {
    parsed = JSON.parse(rawText);
  } catch {
    parsed = rawText;
  }

  return {
    ok: response.ok,
    status: response.status,
    data: parsed,
  };
}

async function callTrpcMutation(path, input) {
  const response = await fetch(`${BACKEND_URL}/trpc/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ json: input }),
  });

  const rawText = await response.text();
  let parsed = null;

  try {
    parsed = JSON.parse(rawText);
  } catch {
    parsed = rawText;
  }

  return {
    ok: response.ok,
    status: response.status,
    data: parsed,
  };
}

function extractTrpcJson(payload) {
  return payload?.result?.data?.json ?? payload?.error?.json ?? payload;
}

async function testBackend() {
  console.log('Testing Easy Seas Backend Integration\n');
  console.log('='.repeat(60));
  console.log('Backend URL:', BACKEND_URL);
  console.log('Test email:', TEST_EMAIL);

  console.log('\n1. Testing backend health...');
  try {
    const healthRes = await fetch(`${BACKEND_URL}/`);
    const healthData = await healthRes.json();
    console.log('✅ Backend is online:', healthData);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('❌ Backend health check failed:', message);
    return;
  }

  console.log('\n2. Testing database write path (data.saveAllUserData)...');
  const savePayload = {
    email: TEST_EMAIL,
    cruises: [],
    bookedCruises: [],
    casinoOffers: [],
    calendarEvents: [],
    casinoSessions: [],
    certificates: [],
    alerts: [],
    alertRules: [],
    slotAtlas: [],
    crewRecognitionEntries: [],
    crewRecognitionSailings: [],
    userPoints: 42,
    settings: {
      notifications: true,
      theme: 'system',
    },
  };

  const saveResponse = await callTrpcMutation('data.saveAllUserData', savePayload);
  if (!saveResponse.ok) {
    console.log('❌ Save endpoint returned error:', saveResponse.status);
    console.log('Details:', saveResponse.data);
    return;
  }
  console.log('✅ Save endpoint working:', extractTrpcJson(saveResponse.data));

  console.log('\n3. Testing database read path (data.getAllUserData)...');
  const readResponse = await callTrpcQuery('data.getAllUserData', { email: TEST_EMAIL });
  if (!readResponse.ok) {
    console.log('❌ Read endpoint returned error:', readResponse.status);
    console.log('Details:', readResponse.data);
    return;
  }

  const readJson = extractTrpcJson(readResponse.data);
  console.log('✅ Read endpoint working:', readJson);

  console.log('\n4. Testing cruise pricing sync endpoint...');
  const syncPricingResponse = await callTrpcMutation('cruiseDeals.syncPricingForBookedCruises', {
    cruises: [
      {
        id: 'test-123',
        shipName: 'Quantum of the Seas',
        sailDate: '2026-05-15',
        nights: 7,
        departurePort: 'Miami',
      },
    ],
  });

  if (!syncPricingResponse.ok) {
    console.log('❌ Cruise pricing sync returned error:', syncPricingResponse.status);
    console.log('Details:', syncPricingResponse.data);
  } else {
    console.log('✅ Cruise pricing sync reachable:', extractTrpcJson(syncPricingResponse.data));
  }

  console.log('\n5. Testing single cruise search endpoint...');
  const singleCruiseResponse = await callTrpcMutation('cruiseDeals.searchSingleCruise', {
    shipName: 'Quantum of the Seas',
    sailDate: '2026-05-15',
    nights: 7,
    departurePort: 'Miami',
  });

  if (!singleCruiseResponse.ok) {
    console.log('❌ Single cruise search returned error:', singleCruiseResponse.status);
    console.log('Details:', singleCruiseResponse.data);
  } else {
    console.log('✅ Single cruise search reachable:', extractTrpcJson(singleCruiseResponse.data));
  }

  console.log('\n' + '='.repeat(60));
  console.log('Backend smoke test complete.\n');
}

testBackend().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error('❌ Smoke test crashed:', message);
  process.exit(1);
});
