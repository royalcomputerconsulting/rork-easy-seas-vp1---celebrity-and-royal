const BACKEND_URL = "https://rork-easy-seas-vp1-2nep.onrender.com";

async function testBackend() {
  console.log("Testing Easy Seas Backend Integration\n");
  console.log("=".repeat(60));
  
  console.log("\n1. Testing backend health...");
  try {
    const healthRes = await fetch(`${BACKEND_URL}/`);
    const healthData = await healthRes.json();
    console.log("✅ Backend is online:", healthData);
  } catch (error) {
    console.error("❌ Backend health check failed:", error.message);
    return;
  }

  console.log("\n2. Testing cruise pricing sync endpoint...");
  const testCruise = {
    cruises: [{
      id: "test-123",
      shipName: "Quantum of the Seas",
      sailDate: "2025-04-15",
      nights: 7,
      departurePort: "Miami"
    }]
  };

  try {
    const response = await fetch(`${BACKEND_URL}/trpc/cruiseDeals.syncPricingForBookedCruises`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        "0": {
          "json": testCruise
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log("❌ Endpoint returned error:", response.status);
      console.log("Error details:", errorText);
      
      if (errorText.includes('EXPO_PUBLIC_TOOLKIT_URL')) {
        console.log("\n⚠️  IMPORTANT: The backend needs EXPO_PUBLIC_TOOLKIT_URL environment variable");
        console.log("   Please add this to your Render environment variables:");
        console.log(`   EXPO_PUBLIC_TOOLKIT_URL = ${process.env.EXPO_PUBLIC_TOOLKIT_URL || '[Your Toolkit URL]'}`);
      }
    } else {
      const data = await response.json();
      console.log("✅ Endpoint working! Response:", JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error("❌ Request failed:", error.message);
  }

  console.log("\n3. Testing single cruise search...");
  try {
    const response = await fetch(`${BACKEND_URL}/trpc/cruiseDeals.searchSingleCruise`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        "0": {
          "json": {
            shipName: "Quantum of the Seas",
            sailDate: "2025-04-15",
            nights: 7,
            departurePort: "Miami"
          }
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log("❌ Search endpoint error:", response.status);
      console.log("Details:", errorText);
    } else {
      const data = await response.json();
      console.log("✅ Search working! Found deals:", data);
    }
  } catch (error) {
    console.error("❌ Search failed:", error.message);
  }

  console.log("\n" + "=".repeat(60));
  console.log("Test complete!\n");
}

testBackend().catch(console.error);
