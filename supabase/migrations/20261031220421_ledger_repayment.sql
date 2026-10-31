-- واپسی (repayment): cash a worker hands back, e.g. 40,000 of a 50,000 advance. It is
-- the opposite of an advance: it lowers what he owes (raises his balance by the amount).
-- Before this, the only ways to record it were wrong ones — a correction (erases the
-- advance, all or nothing), a bonus (the right sum, but says we rewarded him), or a
-- deduction (moves the balance the wrong way).
--
-- Additive: the kind check gains one value; no row changes. Phones on an app version
-- that doesn't know 'repayment' would count it as zero, so ship the app update (and
-- raise app_config.min_supported_version) before anyone records one.

alter table ledger_entry drop constraint ledger_entry_kind_check;
alter table ledger_entry add constraint ledger_entry_kind_check
  check (kind in ('advance', 'payment', 'deduction', 'bonus', 'correction', 'repayment'));
