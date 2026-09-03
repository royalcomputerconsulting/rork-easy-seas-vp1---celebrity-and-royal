const assert = require('node:assert/strict');
const fs = require('node:fs');

const read = (relative) => fs.readFileSync(relative, 'utf8');
const detail = read('app/(tabs)/(overview)/cruise-details.tsx');
const core = read('state/CoreDataProvider.tsx');
const backup = read('lib/dataBundle/bundleOperations.ts');
const casino = read('components/casino/CasinoCommandCenter.tsx');
const casinoTruth = read('lib/casino/casinoTruthEngine.ts');

// The actual itinerary is a top-level fact, before planning intelligence.
const itineraryIndex = detail.indexOf('testID="cruise-details-top-itinerary"');
const planningIndex = detail.indexOf('testID="cruise-details-phase3-planning-intelligence"');
assert.ok(itineraryIndex >= 0, 'Cruise detail must expose the actual itinerary at the top.');
assert.ok(planningIndex > itineraryIndex, 'Planning intelligence must follow the actual itinerary.');
for (const marker of [
  'Actual itinerary',
  'No itinerary rows are attached yet',
  'testID="cruise-details-planning-no-itinerary"',
  'testID="cruise-details-planning-loading"',
]) assert.ok(detail.includes(marker), `Cruise detail itinerary state is missing ${marker}.`);

// Every planning control must be a wired action with a stable acceptance hook.
for (const marker of [
  'testID="open-port-history-from-cruise"',
  'testID="open-port-history-detail"',
  'testID="cruise-replacement-goal-picker"',
  'onPress={() => setSelectedReplacementGoal(goal.id)}',
  'testID={`open-replacement-cruise-${candidate.cruise.id}`}',
  "params: buildCruiseDetailsParams(candidate.cruise, { source: 'replacement-finder' })",
]) assert.ok(detail.includes(marker), `Cruise Planning action is missing ${marker}.`);

// The complete editable trip record remains together. Manual post-sailing truth
// is written to every compatibility alias and explicitly marked as exact/manual.
for (const marker of [
  'reservationNumber',
  'stateroomNumber',
  'stateroomCategoryCode',
  'stateroomType',
  'guestNames',
  'cabinType: editForm.cabinType',
  'guests: knownGuestCount(editForm.guests)',
  'totalPrice: parseFloat(editForm.amountPaid)',
  'price: parseFloat(editForm.amountPaid)',
  'tradeInValue: parseFloat(editForm.tradeInValue)',
  'nextCruiseCertificate: parseFloat(editForm.nextCruiseCertificate)',
  'notes: editForm.notes',
  'winningsBroughtHome: winLossValue',
  'totalWinnings: winLossValue',
  'netResult: winLossValue',
  'cashResult: winLossValue',
  "casinoCloseoutSource: 'manual'",
  'postCruiseCloseoutAt: new Date().toISOString()',
  'pointsEarned: casinoPointsValue',
  'earnedPoints: casinoPointsValue',
  'casinoPoints: casinoPointsValue',
  "pointsSource: 'manual'",
  "casinoPointsSource: 'user_entered'",
  "pointsCalculationConfidence: 'exact'",
  'testID="save-cruise-full-edit"',
  'testID="save-casino-stats-button"',
  'testID="cruise-details-upload-invoice"',
]) assert.ok(detail.includes(marker), `Cruise record persistence is missing ${marker}.`);

// Detail writes through the durable owner-scoped booked repository. The same
// record is consumed by Casino and included in portable backup/restore.
assert.match(detail, /updateCruiseInStore\(updatedCruise\.id, updatedCruise\)/);
assert.match(core, /scheduleBackgroundPersist\(skRef\.current\.BOOKED_CRUISES, updated\)/);
assert.match(casino, /bookedCruises/);
assert.match(casino, /buildCasinoCruiseTruth/);
assert.match(casinoTruth, /\[cruise\.pointsEarned, cruise\.earnedPoints, cruise\.casinoPoints\]/);
assert.match(backup, /bookedCruises = normalizeCruisesWithCasinoEconomics/);
assert.match(backup, /bookedCruises,/);
assert.match(backup, /bundle\.bookedCruises && Array\.isArray\(bundle\.bookedCruises\)/);
assert.match(backup, /replaceHighVolumeDomain\(repositoryOwner, 'booked_cruises', enrichedBooked/);

console.log('PASS Build 445 Item 24 itinerary-first cruise detail, working planning actions, complete edits, casino truth, and backup/restore persistence');
