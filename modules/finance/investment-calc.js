// investment-calc.js — calculation engine for investment products

const CURRENCY_SYMBOLS = { JPY: '¥', IDR: 'Rp ', GBP: '£', USD: '$', CNY: '¥' };

function fmt(currency, amount) {
  const sym = CURRENCY_SYMBOLS[currency] ?? (currency + ' ');
  return sym + Math.round(amount).toLocaleString();
}

function yearsHeld(startDate) {
  if (!startDate) return 0;
  return Math.max(0, (Date.now() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25));
}

function monthsHeld(startDate) {
  if (!startDate) return 0;
  const s = new Date(startDate);
  const n = new Date();
  return Math.max(0, (n.getFullYear() - s.getFullYear()) * 12 + (n.getMonth() - s.getMonth()));
}

// ── Calculation types ──────────────────────────────────────────────────

// 1. Manual — user enters current value; gain = current - invested
function calcManual(item) {
  const cur = item.currency;
  const monthly = item.contributionAmount ?? 0;
  const months = monthsHeld(item.startDate);
  const totalInvested = (item.principal ?? 0) + monthly * months;
  const hasManual = item.currentMarketValue != null && item.currentMarketValue !== '';
  const estimatedValue = hasManual ? item.currentMarketValue : totalInvested;
  const estimatedGain = estimatedValue - totalInvested;

  return {
    estimatedValue,
    totalInvested,
    estimatedGain,
    isEstimate: !hasManual,
    explanationLines: hasManual
      ? [
          'Value entered manually.',
          `Total invested: ${fmt(cur, totalInvested)}`,
          `Gain / loss: ${fmt(cur, estimatedGain)}`,
        ]
      : [
          'No current value entered.',
          `Total invested (estimated): ${fmt(cur, totalInvested)}`,
          'Enter a current value to track gain/loss.',
        ],
  };
}

// 2. Fixed deposit / savings — simple interest
function calcFixedDeposit(item) {
  const cur = item.currency;
  const principal = item.principal ?? 0;
  const rate = (item.interestRate ?? 0) / 100;
  const years = yearsHeld(item.startDate);
  const interest = principal * rate * years;
  const totalInvested = principal;
  const hasManual = item.currentMarketValue != null && item.currentMarketValue !== '';
  const estimatedValue = hasManual ? item.currentMarketValue : (principal + interest);
  const estimatedGain = estimatedValue - totalInvested;

  return {
    estimatedValue,
    totalInvested,
    estimatedGain,
    isEstimate: !hasManual,
    explanationLines: [
      `Principal: ${fmt(cur, principal)}`,
      `Annual rate: ${item.interestRate ?? 0}%`,
      `Time held: ${years.toFixed(2)} years`,
      `Estimated interest: ${fmt(cur, interest)} (simple interest)`,
      hasManual
        ? 'Using manually entered current value.'
        : 'Estimate only. Enter current value to use actual balance.',
    ],
  };
}

// 3. Bond / government bond — principal + coupon income
function calcBond(item) {
  const cur = item.currency;
  const principal = item.principal ?? 0;
  const rate = (item.couponRate ?? item.interestRate ?? 0) / 100;
  const years = yearsHeld(item.startDate);
  const income = principal * rate * years;
  const totalInvested = principal;
  const hasManual = item.currentMarketValue != null && item.currentMarketValue !== '';
  const estimatedValue = hasManual ? item.currentMarketValue : (principal + income);
  const estimatedGain = estimatedValue - totalInvested;

  return {
    estimatedValue,
    totalInvested,
    estimatedGain,
    isEstimate: !hasManual,
    explanationLines: [
      `Principal: ${fmt(cur, principal)}`,
      `Coupon rate: ${item.couponRate ?? item.interestRate ?? 0}% per year`,
      `Time held: ${years.toFixed(2)} years`,
      `Estimated coupon income so far: ${fmt(cur, income)}`,
      'Bond market price can differ from face value.',
      hasManual
        ? 'Using manually entered current value.'
        : 'Estimate only. Enter current value if you know the actual price.',
    ],
  };
}

// 4. Recurring investment — compound growth with monthly contributions
function calcRecurring(item) {
  const cur = item.currency;
  const principal = item.principal ?? 0;
  const monthly = item.contributionAmount ?? 0;
  const months = monthsHeld(item.startDate);
  const annualRate = (item.interestRate ?? 0) / 100;
  const monthlyRate = annualRate / 12;
  const totalContributions = monthly * months;
  const totalInvested = principal + totalContributions;

  let estimatedFV;
  if (monthlyRate === 0) {
    estimatedFV = totalInvested;
  } else {
    const principalFV = principal * Math.pow(1 + monthlyRate, months);
    const annuityFV = monthly * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
    estimatedFV = principalFV + annuityFV;
  }

  const hasManual = item.currentMarketValue != null && item.currentMarketValue !== '';
  const estimatedValue = hasManual ? item.currentMarketValue : estimatedFV;
  const estimatedGain = estimatedValue - totalInvested;

  return {
    estimatedValue,
    totalInvested,
    estimatedGain,
    isEstimate: !hasManual,
    explanationLines: [
      `Initial amount: ${fmt(cur, principal)}`,
      `Monthly contribution: ${fmt(cur, monthly)} x ${months} months`,
      `Total contributed: ${fmt(cur, totalInvested)}`,
      `Expected annual return: ${item.interestRate ?? 0}%`,
      `Estimated value using compound growth: ${fmt(cur, estimatedFV)}`,
      'Estimate only. Does not include fees, taxes, or market changes.',
      hasManual
        ? 'Using manually entered current value. Estimate shown above for reference.'
        : 'Enter current value to replace this estimate.',
    ],
  };
}

// ── Dispatch ───────────────────────────────────────────────────────────

const CALC_FNS = {
  manual:               calcManual,
  fixedDeposit:         calcFixedDeposit,
  bond:                 calcBond,
  recurringInvestment:  calcRecurring,
  taxAdvantagedWrapper: calcRecurring,
  manualOrPrizeBased:   calcManual,
};

export function calculate(item, productDef) {
  const fn = CALC_FNS[productDef?.calculationType] ?? calcManual;
  return fn({ ...item, currency: item.currency ?? productDef?.currency ?? 'JPY' });
}
