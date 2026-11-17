const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function fixture() {
  const events = [], broadcasts = [];
  const sandbox = {
    window: { location: { protocol: 'https:' } },
    document: { readyState: 'loading', addEventListener() {}, querySelector() { return null; }, dispatchEvent(event) { events.push(event); } },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } }
  };
  const source = fs.readFileSync(path.join(__dirname, '..', 'inventory.js'), 'utf8');
  const injection = `window.testConfirmedPublication = {
    setup(value, revision, dirty=false, saves=0) {
      state=value; serverSavedAt=revision; warehouseDirty=dirty; activeServerSaves=saves;
      inventoryLifecycle=()=>({}); availabilityObservationText=()=>'';
      statsForItem=item=>({physical:item.quantity,consumed:0,out:0,workshop:0,rented:0,lost:0});
    }, publish:publishWarehouseAvailability, acknowledge:announceSavedWarehouse,
    channel(value) { warehouseChannel=value; },
    edit(quantity) { state.items[0].quantity=quantity; warehouseDirty=true; },
    state() { return state; }
  };`;
  vm.createContext(sandbox);
  vm.runInContext(source.replace('  if (document.readyState === "loading") {', injection+'\n  if (document.readyState === "loading") {'), sandbox);
  const api = sandbox.window.testConfirmedPublication;
  api.channel({ postMessage(payload) { broadcasts.push(payload); } });
  return { api, events, broadcasts, window:sandbox.window };
}
const state = quantity => ({ items:[{id:'synthetic-stock',name:'Unidad actual sintética',category:'AUDIO',quantity}], movements:[], updatedAt:'2026-11-17T12:00:00Z' });

test('HTTP publication never presents unacknowledged edits or pending saves as current inventory', () => {
  const f=fixture();
  for (const [revision,dirty,saves] of [['',false,0],['2026-11-17T12:00:00Z',true,0],['2026-11-17T12:00:00Z',false,1]]) {
    f.api.setup(state(99),revision,dirty,saves);f.api.publish();
    assert.equal(f.events.length,0);assert.equal(f.window.LIVE_WAREHOUSE_AVAILABILITY,undefined);
  }
});

test('published inventory is an immutable server revision even when the live form is edited later', () => {
  const f=fixture();f.api.setup(state(5),'2026-11-17T12:00:00Z');f.api.publish();
  const snapshot=f.window.LIVE_WAREHOUSE_AVAILABILITY;
  f.api.edit(99);f.api.publish();
  assert.equal(f.events.length,1);assert.equal(snapshot.state.items[0].quantity,5);
  assert.equal(snapshot.savedAt,'2026-11-17T12:00:00Z');
  assert.equal(f.window.LIVE_WAREHOUSE_AVAILABILITY,snapshot);
});

test('an acknowledged save reaches Requerimiento with its confirmed values while newer edits remain pending', () => {
  const f=fixture();f.api.setup(state(99),'2026-11-17T12:00:00Z',true,1);
  const acknowledgement={state:state(7),savedAt:'2026-11-17T12:01:00Z'};
  f.api.acknowledge(acknowledgement);
  assert.equal(f.events.length,1);assert.equal(f.events[0].type,'live:warehouse-server-updated');
  assert.equal(f.events[0].detail.state.items[0].quantity,7);
  assert.equal(f.window.LIVE_WAREHOUSE_AVAILABILITY.savedAt,acknowledgement.savedAt);
  assert.equal(f.api.state().items[0].quantity,99);
  acknowledgement.state.items[0].quantity=999;
  assert.equal(f.events[0].detail.state.items[0].quantity,7);
  assert.equal(f.broadcasts[0].state.items[0].quantity,7);
});
