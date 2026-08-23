import json
import tempfile
import unittest
from pathlib import Path

import server


class ReferralTests(unittest.TestCase):
    def setUp(self):
        self.tempdir = tempfile.TemporaryDirectory()
        self.original_data_file = server.DATA_FILE
        server.DATA_FILE = Path(self.tempdir.name) / "crm_data.json"
        db = server.empty_db()
        db["clients"] = {
            "referrer": {"name": "Анна", "bonus_balance": 0, "money_balance": 0, "club_balance": 0},
            "invitee-1": {"name": "Михаил", "bonus_balance": 0, "money_balance": 0, "club_balance": 0},
            "invitee-2": {"name": "Ольга", "bonus_balance": 0, "money_balance": 0, "club_balance": 0},
            "invitee-3": {"name": "Иван", "bonus_balance": 0, "money_balance": 0, "club_balance": 0},
        }
        db["referral_codes"] = {}
        db["referrals"] = {}
        server.save_db(db)

    def tearDown(self):
        server.DATA_FILE = self.original_data_file
        self.tempdir.cleanup()

    def register(self, invitee_key):
        db = server.load_db()
        code = server.ensure_referral_code(db, "referrer", 100)
        server.save_db(db)
        profile = {"client_key": invitee_key, "provider": "telegram"}
        server.register_referral(profile, f"ref_{code}")
        return code

    def activate(self, invitee_key, sequence):
        db = server.load_db()
        server.Handler._activate_referral(db, invitee_key, f"order-{sequence}", 1_000 + sequence)
        server.save_db(db)

    def test_registers_once_and_rejects_self_referral(self):
        code = self.register("invitee-1")
        server.register_referral({"client_key": "invitee-1", "provider": "telegram"}, f"ref_{code}")
        server.register_referral({"client_key": "referrer", "provider": "telegram"}, f"ref_{code}")
        db = server.load_db()
        self.assertEqual(list(db["referrals"]), ["invitee-1"])
        self.assertEqual(db["referrals"]["invitee-1"]["status"], "registered")

    def test_first_purchase_awards_both_sides_once(self):
        self.register("invitee-1")
        self.activate("invitee-1", 1)
        self.activate("invitee-1", 2)
        db = server.load_db()
        self.assertEqual(db["clients"]["invitee-1"]["bonus_balance"], 50)
        self.assertEqual(db["clients"]["referrer"]["bonus_balance"], 50)
        self.assertEqual(db["referrals"]["invitee-1"]["status"], "active")
        referral_transactions = [item for item in db["loyalty_transactions"] if str(item.get("event", "")).startswith("referral.")]
        self.assertEqual(len(referral_transactions), 2)

    def test_three_active_friends_award_milestone_once(self):
        for sequence in range(1, 4):
            invitee_key = f"invitee-{sequence}"
            self.register(invitee_key)
            self.activate(invitee_key, sequence)
        self.activate("invitee-3", 99)
        db = server.load_db()
        self.assertEqual(db["clients"]["referrer"]["bonus_balance"], 250)
        self.assertTrue(db["clients"]["referrer"]["referral_milestone_awarded"])
        self.assertEqual(sum(1 for item in db["referrals"].values() if item["status"] == "active"), 3)

    def test_confirmed_dispense_activates_referral_even_for_preorder(self):
        self.register("invitee-1")
        db = server.load_db()
        db["payments"]["pay-1"] = {
            "id": "pay-1",
            "status": "succeeded",
            "amount": 180,
            "currency": "RUB",
            "method": "sbp",
            "client_key": "invitee-1",
            "phone": "",
            "order": {"product_id": "vanilla-180", "topping_id": "none", "additive_id": "none"},
            "loyalty_eligible": False,
        }
        order = {"order_id": "order-dispensed", "payment_id": "pay-1", "product_released": True}
        server.Handler._finalize_completed_order(db, order, 2_000)
        server.save_db(db)
        result = server.load_db()
        self.assertEqual(result["referrals"]["invitee-1"]["status"], "active")
        self.assertEqual(result["clients"]["invitee-1"]["bonus_balance"], 50)
        self.assertEqual(result["clients"]["referrer"]["bonus_balance"], 50)

    def test_channel_links_are_distinct_and_contain_no_client_identifier(self):
        db = server.load_db()
        code = server.ensure_referral_code(db, "referrer", 100)
        links = server.referral_links(code)
        self.assertIn(f"/r/{code}", links["referral_url"])
        self.assertIn(f"/r/telegram/{code}", links["telegram_referral_url"])
        self.assertIn(f"/r/max/{code}", links["max_referral_url"])
        self.assertIn(f"ref_tg_{code}", links["telegram_invite_url"])
        for value in (links["referral_url"], links["telegram_referral_url"], links["max_referral_url"]):
            self.assertNotIn("referrer", value)

    def test_channel_bound_referral_accepts_matching_provider(self):
        db = server.load_db()
        code = server.ensure_referral_code(db, "referrer", 100)
        server.save_db(db)
        result = server.register_referral(
            {"client_key": "invitee-1", "provider": "telegram"},
            f"ref_tg_{code}",
        )
        self.assertEqual(result["status"], "registered")
        referral = server.load_db()["referrals"]["invitee-1"]
        self.assertEqual(referral["source_provider"], "telegram")
        self.assertEqual(referral["intended_provider"], "telegram")

    def test_channel_bound_referral_rejects_mismatched_provider(self):
        db = server.load_db()
        code = server.ensure_referral_code(db, "referrer", 100)
        server.save_db(db)
        result = server.register_referral(
            {"client_key": "invitee-1", "provider": "max"},
            f"ref_tg_{code}",
        )
        self.assertEqual(result["status"], "channel_mismatch")
        self.assertIn("Telegram", result["warning"])
        self.assertNotIn("invitee-1", server.load_db()["referrals"])

    def test_old_data_file_is_migrated_without_losing_client(self):
        legacy = {
            "clients": {"legacy": {"name": "Старый клиент", "bonus_balance": 17}},
            "preorders": {},
        }
        server.DATA_FILE.write_text(json.dumps(legacy, ensure_ascii=False), encoding="utf-8")
        db = server.load_db()
        self.assertEqual(db["clients"]["legacy"]["bonus_balance"], 17)
        self.assertIn("referral_codes", db)
        self.assertIn("referrals", db)
        self.assertIn("referral_settings", db)

    def test_telegram_start_message_contains_kindness_button(self):
        calls = []
        original_api = server.telegram_api
        server.telegram_api = lambda method, payload=None, timeout=35: calls.append((method, payload))
        try:
            server.telegram_start_message(123)
        finally:
            server.telegram_api = original_api
        self.assertEqual(len(calls), 1)
        keyboard = calls[0][1]["reply_markup"]["inline_keyboard"]
        self.assertEqual(keyboard[0][0]["text"], "Вступить в Клуб Тимоши")
        self.assertEqual(keyboard[1][0]["text"], "❤️ Кнопка добра")
        self.assertIn("section=good-deeds", keyboard[1][0]["web_app"]["url"])

    def _profile(self, key, user_id, name):
        return {
            "client_key": key, "identity_key": f"telegram:{user_id}", "provider": "telegram",
            "id": user_id, "first_name": name, "auth_mode": "demo", "phone": "",
        }

    def _paid_preorder(self):
        db = server.load_db()
        preorder = server.demo_preorder(1_000)
        preorder.update({
            "preorder_id": "transfer-order", "identity_key": "telegram:101",
            "identity_provider": "telegram", "provider_user_id": 101,
            "client_key": "referrer", "status": "paid_waiting_pickup",
            "expires_at": int(__import__("time").time()) + 3_600,
        })
        db["preorders"][preorder["preorder_id"]] = preorder
        server.save_db(db)
        return preorder

    def test_paid_order_transfer_is_single_use_and_changes_holder(self):
        self._paid_preorder()
        owner = self._profile("referrer", 101, "Анна")
        recipient = self._profile("invitee-1", 202, "Михаил")
        original_auth = server.authenticate_webapp
        try:
            server.authenticate_webapp = lambda payload: owner
            offer = server.Handler.create_preorder_transfer({"preorder_id": "transfer-order"})
            token = offer["transfer_url"].rsplit("/", 1)[-1]
            server.authenticate_webapp = lambda payload: recipient
            accepted = server.Handler.accept_preorder_transfer({"transfer_token": token})
            self.assertEqual(accepted["viewer_role"], "recipient")
            self.assertEqual(accepted["transfer_status"], "accepted")
            with self.assertRaises(ValueError):
                server.Handler.accept_preorder_transfer({"transfer_token": token})
        finally:
            server.authenticate_webapp = original_auth
        stored = server.load_db()["preorders"]["transfer-order"]
        self.assertFalse(server.Handler._preorder_belongs_to(stored, owner))
        self.assertTrue(server.Handler._preorder_belongs_to(stored, recipient))

    def test_only_recipient_can_activate_pickup_after_transfer(self):
        self._paid_preorder()
        owner = self._profile("referrer", 101, "Анна")
        recipient = self._profile("invitee-1", 202, "Михаил")
        original_auth = server.authenticate_webapp
        try:
            server.authenticate_webapp = lambda payload: owner
            offer = server.Handler.create_preorder_transfer({"preorder_id": "transfer-order"})
            token = offer["transfer_url"].rsplit("/", 1)[-1]
            server.authenticate_webapp = lambda payload: recipient
            server.Handler.accept_preorder_transfer({"transfer_token": token})
            server.authenticate_webapp = lambda payload: owner
            with self.assertRaises(ValueError):
                server.Handler.activate_tma_pickup({"preorder_id": "transfer-order"})
            server.authenticate_webapp = lambda payload: recipient
            ticket = server.Handler.activate_tma_pickup({"preorder_id": "transfer-order"})
            self.assertEqual(ticket["status"], "pickup_code_active")
            self.assertEqual(len(ticket["manual_code"]), 6)
        finally:
            server.authenticate_webapp = original_auth

    def test_expired_transferred_order_refunds_original_buyer(self):
        self._paid_preorder()
        owner = self._profile("referrer", 101, "Анна")
        recipient = self._profile("invitee-1", 202, "Михаил")
        original_auth = server.authenticate_webapp
        try:
            server.authenticate_webapp = lambda payload: owner
            offer = server.Handler.create_preorder_transfer({"preorder_id": "transfer-order"})
            token = offer["transfer_url"].rsplit("/", 1)[-1]
            server.authenticate_webapp = lambda payload: recipient
            server.Handler.accept_preorder_transfer({"transfer_token": token})
            db = server.load_db()
            db["preorders"]["transfer-order"]["expires_at"] = 1
            server.save_db(db)
            server.Handler.tma_account({})
        finally:
            server.authenticate_webapp = original_auth
        db = server.load_db()
        self.assertEqual(db["clients"]["referrer"]["money_balance"], 260)
        self.assertEqual(db["clients"]["invitee-1"]["money_balance"], 0)

    def test_anonymous_gift_hides_sender_and_keeps_wish(self):
        self._paid_preorder()
        owner = self._profile("referrer", 101, "Анна")
        recipient = self._profile("invitee-1", 202, "Михаил")
        original_auth = server.authenticate_webapp
        try:
            server.authenticate_webapp = lambda payload: owner
            offer = server.Handler.create_preorder_transfer({
                "preorder_id": "transfer-order", "sender_visibility": "anonymous",
                "gift_message": "Пусть сегодня будет немного счастливее 🍦",
            })
            token = offer["transfer_url"].rsplit("/", 1)[-1]
            server.authenticate_webapp = lambda payload: recipient
            preview = server.Handler.preview_preorder_transfer({"transfer_token": token})
        finally:
            server.authenticate_webapp = original_auth
        self.assertEqual(preview["sender_name"], "Добрый друг")
        self.assertEqual(preview["gift_message"], "Пусть сегодня будет немного счастливее 🍦")
        self.assertNotIn("Анна", json.dumps(preview, ensure_ascii=False))

    def test_recipient_can_thank_and_share_gift_in_vk(self):
        self._paid_preorder()
        owner = self._profile("referrer", 101, "Анна")
        recipient = self._profile("invitee-1", 202, "Михаил")
        original_auth = server.authenticate_webapp
        try:
            server.authenticate_webapp = lambda payload: owner
            offer = server.Handler.create_preorder_transfer({"preorder_id": "transfer-order"})
            token = offer["transfer_url"].rsplit("/", 1)[-1]
            server.authenticate_webapp = lambda payload: recipient
            server.Handler.accept_preorder_transfer({"transfer_token": token})
            thanked = server.Handler.thank_for_preorder_transfer({"preorder_id": "transfer-order"})
            shared = server.Handler.share_preorder_transfer_vk({"preorder_id": "transfer-order"})
            server.authenticate_webapp = lambda payload: owner
            owner_account = server.Handler.tma_account({})
        finally:
            server.authenticate_webapp = original_auth
        self.assertTrue(thanked["thanked"])
        self.assertIn("vk.com/share.php", shared["vk_share_url"])
        self.assertIn("Михаил", owner_account["orders"][0]["thanks_received_name"])
        self.assertEqual(owner_account["notifications"][0]["type"], "gift_thanks")
        events = [item.get("event") for item in server.load_db()["gateway_audit"]]
        self.assertIn("preorder.transfer.thanked", events)
        self.assertIn("preorder.transfer.shared.vk", events)


if __name__ == "__main__":
    unittest.main()
