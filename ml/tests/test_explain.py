from features.feature_engineering import FEATURE_NAMES
from inference.explain import describe, protective_factors, top_factors


def test_every_feature_has_a_neutral_description():
    for name in FEATURE_NAMES:
        text = describe(name, 3.0)
        assert isinstance(text, str) and text and "undefined" not in text


def test_descriptions_do_not_claim_risk_for_benign_values():
    assert "only" not in describe("recipient_account_age_days", 515)
    assert "only" not in describe("sender_device_age", 836)
    assert describe("recipient_account_age_days", 0.2) == "Recipient account was created today"
    assert "No blocked account" in describe("distance_to_blocked_entity", 4)
    assert "unusual" not in describe("hour_of_day", 14)


def test_protective_factors_carry_text_and_only_negative_contributions():
    names = ["recipient_account_age_days", "amount", "new_device"]
    out = protective_factors(names, [900.0, 500.0, 0.0], [-3.0, 0.1, -0.5])
    assert [f["feature"] for f in out] == ["recipient_account_age_days", "new_device"]
    assert all(f["text"] and f["contribution"] < 0 for f in out)


def test_top_factors_are_sorted_and_labelled_by_impact():
    names = ["amount", "new_device", "recipient_account_age_days"]
    out = top_factors(names, [100.0, 1.0, 2.0], [0.4, 0.02, 2.5])
    assert [f["feature"] for f in out] == ["recipient_account_age_days", "amount"]
    assert out[0]["impact"] == "high" and out[1]["impact"] == "medium"
