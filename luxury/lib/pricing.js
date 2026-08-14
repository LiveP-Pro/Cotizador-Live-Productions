export function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function calculateQuote(input, rates) {
  const kilometers = Math.max(0, Number(input.kilometers || 0));
  const minutes = Math.max(0, Number(input.minutes || 0));
  const waitingMinutes = Math.max(0, Number(input.waitingMinutes || 0));
  const fixedFare = Math.max(0, Number(input.fixedFare || 0));
  const vehicleCount = Math.max(1, Number(input.vehicleCount || input.vehicleIds?.length || 1));
  const fixedFareIncludesTax = false;

  const distanceCharge = fixedFare ? 0 : kilometers * Number(rates.pricePerKm || 0);
  const timeCharge = fixedFare ? 0 : minutes * Number(rates.pricePerMinute || 0);
  const baseCalculated = fixedFare ? fixedFare * vehicleCount : distanceCharge + timeCharge;
  const baseFare = Math.max(baseCalculated, Number(rates.minimumFare || 0));

  const nightSurcharge = input.applyNightSurcharge
    ? Number(rates.nightSurcharge || 0)
    : 0;
  const airportSurcharge = input.applyAirportSurcharge
    ? Number(rates.airportSurcharge || 0)
    : 0;
  const waitingCharge =
    (waitingMinutes / 60) * Number(rates.waitingPerHour || 0);
  const extras = Math.max(0, Number(input.extraCharges || 0));

  const subtotalBeforeDiscount =
    baseFare + nightSurcharge + airportSurcharge + waitingCharge + extras;
  const discountPercent = Math.min(
    100,
    Math.max(0, Number(input.discountPercent ?? rates.discountPercent ?? 0)),
  );
  const discountAmount = Math.max(0, Number(input.discountAmount || 0));
  const discount = Math.min(subtotalBeforeDiscount, subtotalBeforeDiscount * (discountPercent / 100) + discountAmount);
  const subtotal = subtotalBeforeDiscount - discount;
  const taxPercent = input.includeTax === false
    ? 0
    : Math.max(0, Number(rates.taxPercent || 0));
  const taxDivisor = 1 + taxPercent / 100;
  const includedTax = fixedFareIncludesTax && taxPercent > 0;
  const taxableSubtotal = includedTax ? subtotal / taxDivisor : subtotal;
  const tax = includedTax ? subtotal - taxableSubtotal : subtotal * (taxPercent / 100);
  const total = includedTax ? subtotal : subtotal + tax;

  return {
    kilometers: roundMoney(kilometers),
    minutes: Math.round(minutes),
    fixedFare: roundMoney(fixedFare),
    vehicleCount: roundMoney(vehicleCount),
    fixedFareIncludesTax,
    distanceCharge: roundMoney(distanceCharge),
    timeCharge: roundMoney(timeCharge),
    baseCalculated: roundMoney(baseCalculated),
    baseFare: roundMoney(baseFare),
    nightSurcharge: roundMoney(nightSurcharge),
    airportSurcharge: roundMoney(airportSurcharge),
    waitingCharge: roundMoney(waitingCharge),
    extraCharges: roundMoney(extras),
    subtotalBeforeDiscount: roundMoney(subtotalBeforeDiscount),
    discountPercent: roundMoney(discountPercent),
    discountAmount: roundMoney(discountAmount),
    discount: roundMoney(discount),
    subtotal: roundMoney(taxableSubtotal),
    taxPercent: roundMoney(taxPercent),
    tax: roundMoney(tax),
    total: roundMoney(total),
  };
}
