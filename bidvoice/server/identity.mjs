/**
 * Standing identity + silent defaults for the broker.
 *
 * These come straight from the OFFER project spec. The broker is the only
 * licensed party; BidVoice drafts, the broker reviews and signs. Defaults are
 * applied *silently* but always surfaced in the summary as "(default)" so the
 * broker can see and change anything in one tap/word.
 *
 * For v0 this is a single broker. The shape is multi-tenant-ready: everything
 * lives on a `broker` row so a future signup just creates another row.
 */

export const STANDING_IDENTITY = {
  broker_name: 'Ben Morton',
  brokerage: 'Columbia Partners Real Estate',
  mls_office_no: '5716',
  firm_lag_no: '78990',
  dol_license_no: '101989',
  email: 'ben@benmortongroup.com',
  phone: '206-395-6757',
  entity: 'Ben Morton Group LLC (S-corp)',
  address: '521 16th Ave E #9, Seattle WA 98112',
};

/**
 * Silent defaults. Each is applied unless the broker's words override it; the
 * coordinator marks every defaulted field so the summary can badge it.
 */
export const DEFAULTS = {
  earnest_money: { amount: 10000, holder: 'Closing Agent', days_to_deposit: 2 },
  default_remedy: 'Forfeiture of Earnest Money',
  closing_days_out: 45,
  possession: 'On Closing',
  info_verification_days: 10,
  buyer_brokerage_compensation_pct: 2.5, // both ¶17 blanks
  title: {
    ask_once_per_county: true,
    thurston_default: { company: 'Thurston County Title', contact: 'Molly Morse' },
  },
  inspection: {
    // Prefer Form 34 (review of seller's inspection report) when a recent seller
    // inspection exists; otherwise Form 35 inspection contingency at 10 days.
    prefer_form_34_when_seller_report: true,
    default_form: '35',
    default_days: 10,
  },
  firpta: { form21_para14: 'is not a foreign person' }, // don't duplicate on 22D unless asked
};

/**
 * Seller-financing templates — two distinct postures depending on which side
 * the broker represents (from the spec). These pre-fill the 22C carry terms.
 */
export const SELLER_FINANCING = {
  buyer_side: {
    prepayment: 'OPEN ($X or more)',
    security: 'First-position Deed of Trust, LPB 22A',
    due_on_sale: true,
    balloon: 'as specified',
    statute: 'RCW 61.24',
    recording: 'recorded in property county',
  },
  seller_side: {
    prepayment: 'LOCKED OUT',
    rate_pct: 5.75,
    amortization_years: 30,
    balloon_years: 7,
    down_payment: 50000,
  },
};

export function defaultBroker() {
  return { ...STANDING_IDENTITY };
}
