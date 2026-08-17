import test from "node:test";
import assert from "node:assert/strict";
import { calculateQuote } from "../lib/pricing.js";

const rates = {
  pricePerKm: 5,
  pricePerMinute: 1,
  minimumFare: 150,
  nightSurcharge: 0,
  airportSurcharge: 0,
  waitingPerHour: 0,
  discountPercent: 0,
  taxPercent: 12,
};

test("las tarifas desglosadas se multiplican por la cantidad de Mercedes", () => {
  const totals = calculateQuote(
    { fixedFare: 1250, vehicleCount: 3, includeTax: false },
    rates,
  );
  assert.equal(totals.baseFare, 3750);
  assert.equal(totals.total, 3750);
});

test("el precio final manual representa toda la cotización y no se multiplica", () => {
  const totals = calculateQuote(
    {
      fixedFare: 7500,
      fixedFareIsTotal: true,
      vehicleCount: 3,
      includeTax: true,
    },
    rates,
  );
  assert.equal(totals.baseFare, 7500);
  assert.equal(totals.tax, 900);
  assert.equal(totals.total, 8400);
});
