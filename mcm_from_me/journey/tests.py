from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .models import JourneySession, Product


class Chapter3JourneyFlowTests(APITestCase):
    def setUp(self):
        self.product = Product.objects.create(
            id="ELLA_BOSTON_BAG",
            nfc_tag_id="NFC_ELLA_001",
            qr_code_id="QR_ELLA_001",
            name="Ella Boston Bag",
            image_url="https://example.com/ella.jpg",
            story_title="A timeless shape for what comes next.",
            story_desc="A piece for a new journey.",
        )
        self.session = JourneySession.objects.create(
            current_chapter="C2",
            last_active_screen="C2-07",
            selected_moment="URBAN_ESCAPE",
            product=self.product,
        )

    def test_chapter3_entry_summary_and_completion_update_session_progress(self):
        navigate_response = self.client.post(reverse("navigate_chapter"), {
            "session_id": str(self.session.id),
            "target_chapter": "C3",
        }, format="json")
        self.assertEqual(navigate_response.status_code, status.HTTP_200_OK)
        self.assertEqual(navigate_response.data["currentChapter"], "C3")

        summary_response = self.client.post(reverse("save_style_options"), {
            "session_id": str(self.session.id),
            "carry_option": "CROSSBODY",
            "detail_option": "ROCKET_CHARM",
            "action": "SUMMARY",
        }, format="json")
        self.assertEqual(summary_response.status_code, status.HTTP_200_OK)
        self.assertEqual(summary_response.data["nextScreen"], "C3-SUMMARY")

        self.session.refresh_from_db()
        self.assertEqual(self.session.current_chapter, "C3")
        self.assertEqual(self.session.last_active_screen, "C3-SUMMARY")

        complete_response = self.client.post(reverse("save_style_options"), {
            "session_id": str(self.session.id),
            "carry_option": "CROSSBODY",
            "detail_option": "ROCKET_CHARM",
            "action": "COMPLETE",
        }, format="json")
        self.assertEqual(complete_response.status_code, status.HTTP_200_OK)
        self.assertEqual(complete_response.data["nextScreen"], "C4-01")

        self.session.refresh_from_db()
        self.assertEqual(self.session.current_chapter, "C4")
        self.assertEqual(self.session.last_active_screen, "C4-01")

    def test_invalid_style_combination_returns_e05(self):
        response = self.client.post(reverse("save_style_options"), {
            "session_id": str(self.session.id),
            "carry_option": "INVALID",
            "detail_option": "ROCKET_CHARM",
            "action": "SUMMARY",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["errorCode"], "E-05")
