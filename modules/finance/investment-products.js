// investment-products.js — product catalogue by country

export const COUNTRIES = {
  JP: { label: 'Japan',     currency: 'JPY' },
  ID: { label: 'Indonesia', currency: 'IDR' },
  UK: { label: 'UK',        currency: 'GBP' },
  US: { label: 'USA',       currency: 'USD' },
  CN: { label: 'China',     currency: 'CNY' },
};

// Reusable field definitions — key matches the investment data object
const F = {
  principal:        { key: 'principal',          label: 'Amount invested',             type: 'number'  },
  contribution:     { key: 'contributionAmount',  label: 'Monthly contribution',        type: 'number'  },
  startDate:        { key: 'startDate',           label: 'Start date',                  type: 'date'    },
  maturityDate:     { key: 'maturityDate',        label: 'Maturity date',               type: 'date'    },
  rate:             { key: 'interestRate',        label: 'Expected annual return %',    type: 'percent' },
  couponRate:       { key: 'couponRate',          label: 'Coupon / interest rate %',    type: 'percent' },
  currentValue:     { key: 'currentMarketValue',  label: 'Current value (manual override)', type: 'number' },
  notes:            { key: 'notes',               label: 'Notes',                       type: 'text'    },
};

export const PRODUCTS = {
  JP: {
    nisa: {
      label: 'NISA',
      calculationType: 'recurringInvestment',
      taxTreatment: 'tax-advantaged',
      fields: [F.principal, F.contribution, F.startDate, F.rate, F.currentValue, F.notes],
    },
    ideco: {
      label: 'iDeCo',
      calculationType: 'recurringInvestment',
      taxTreatment: 'tax-advantaged',
      fields: [F.principal, F.contribution, F.startDate, F.rate, F.currentValue, F.notes],
    },
    investmentAccount: {
      label: 'Investment account (tokutei/ippan)',
      calculationType: 'recurringInvestment',
      taxTreatment: 'taxable',
      fields: [F.principal, F.contribution, F.startDate, F.rate, F.currentValue, F.notes],
    },
    fixedDeposit: {
      label: 'Fixed deposit / teiki yokin',
      calculationType: 'fixedDeposit',
      taxTreatment: 'taxable',
      fields: [F.principal, F.startDate, F.maturityDate, F.rate, F.currentValue, F.notes],
    },
    nenkin: {
      label: 'Nenkin / public pension',
      calculationType: 'manual',
      taxTreatment: 'pension',
      fields: [F.principal, F.contribution, F.startDate, F.currentValue, F.notes],
    },
  },

  ID: {
    governmentBond: {
      label: 'Government bond / SBN',
      calculationType: 'bond',
      taxTreatment: 'taxable',
      fields: [F.principal, F.startDate, F.maturityDate, F.couponRate, F.currentValue, F.notes],
    },
    deposit: {
      label: 'Deposito (bank deposit)',
      calculationType: 'fixedDeposit',
      taxTreatment: 'taxable',
      fields: [F.principal, F.startDate, F.maturityDate, F.rate, F.currentValue, F.notes],
    },
    reksadana: {
      label: 'Reksa dana (mutual fund)',
      calculationType: 'recurringInvestment',
      taxTreatment: 'taxable',
      fields: [F.principal, F.contribution, F.startDate, F.rate, F.currentValue, F.notes],
    },
    gold: {
      label: 'Emas (gold)',
      calculationType: 'manual',
      taxTreatment: 'taxable',
      fields: [F.principal, F.startDate, F.currentValue, F.notes],
    },
    jht: {
      label: 'JHT / BPJS Ketenagakerjaan',
      calculationType: 'manual',
      taxTreatment: 'pension',
      fields: [F.principal, F.contribution, F.startDate, F.currentValue, F.notes],
    },
  },

  UK: {
    isa: {
      label: 'ISA',
      calculationType: 'recurringInvestment',
      taxTreatment: 'tax-advantaged',
      fields: [F.principal, F.contribution, F.startDate, F.rate, F.currentValue, F.notes],
    },
    premiumBonds: {
      label: 'Premium Bonds',
      calculationType: 'manual',
      taxTreatment: 'tax-advantaged',
      fields: [F.principal, F.startDate, F.currentValue, F.notes],
    },
    pension: {
      label: 'Pension',
      calculationType: 'recurringInvestment',
      taxTreatment: 'pension',
      fields: [F.principal, F.contribution, F.startDate, F.rate, F.currentValue, F.notes],
    },
    gilts: {
      label: 'Gilts (UK government bonds)',
      calculationType: 'bond',
      taxTreatment: 'taxable',
      fields: [F.principal, F.startDate, F.maturityDate, F.couponRate, F.currentValue, F.notes],
    },
    savings: {
      label: 'Savings / fixed-term account',
      calculationType: 'fixedDeposit',
      taxTreatment: 'taxable',
      fields: [F.principal, F.startDate, F.maturityDate, F.rate, F.currentValue, F.notes],
    },
  },

  US: {
    k401: {
      label: '401(k)',
      calculationType: 'recurringInvestment',
      taxTreatment: 'tax-advantaged',
      fields: [F.principal, F.contribution, F.startDate, F.rate, F.currentValue, F.notes],
    },
    ira: {
      label: 'IRA / Roth IRA',
      calculationType: 'recurringInvestment',
      taxTreatment: 'tax-advantaged',
      fields: [F.principal, F.contribution, F.startDate, F.rate, F.currentValue, F.notes],
    },
    treasury: {
      label: 'Treasury bills / bonds',
      calculationType: 'bond',
      taxTreatment: 'taxable',
      fields: [F.principal, F.startDate, F.maturityDate, F.couponRate, F.currentValue, F.notes],
    },
    brokerage: {
      label: 'Brokerage account',
      calculationType: 'recurringInvestment',
      taxTreatment: 'taxable',
      fields: [F.principal, F.contribution, F.startDate, F.rate, F.currentValue, F.notes],
    },
    cd: {
      label: 'CD (certificate of deposit)',
      calculationType: 'fixedDeposit',
      taxTreatment: 'taxable',
      fields: [F.principal, F.startDate, F.maturityDate, F.rate, F.currentValue, F.notes],
    },
    savings: {
      label: 'Savings account',
      calculationType: 'fixedDeposit',
      taxTreatment: 'taxable',
      fields: [F.principal, F.startDate, F.maturityDate, F.rate, F.currentValue, F.notes],
    },
  },

  CN: {
    bankSavings: {
      label: 'Bank savings (储蓄存款)',
      calculationType: 'fixedDeposit',
      taxTreatment: 'taxable',
      fields: [F.principal, F.startDate, F.maturityDate, F.rate, F.currentValue, F.notes],
    },
    fixedDeposit: {
      label: 'Fixed deposit (定期存款)',
      calculationType: 'fixedDeposit',
      taxTreatment: 'taxable',
      fields: [F.principal, F.startDate, F.maturityDate, F.rate, F.currentValue, F.notes],
    },
    govBond: {
      label: 'Government bonds (国债)',
      calculationType: 'bond',
      taxTreatment: 'taxable',
      fields: [F.principal, F.startDate, F.maturityDate, F.couponRate, F.currentValue, F.notes],
    },
    wealthManagement: {
      label: 'Wealth management product',
      calculationType: 'manual',
      taxTreatment: 'taxable',
      fields: [F.principal, F.startDate, F.currentValue, F.notes],
    },
    pension: {
      label: 'Pension / retirement savings',
      calculationType: 'manual',
      taxTreatment: 'pension',
      fields: [F.principal, F.contribution, F.startDate, F.currentValue, F.notes],
    },
  },
};
