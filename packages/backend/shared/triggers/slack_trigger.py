"""
Slack Trigger Executor

Slack Workflow Webhook을 통해 event_data dict를 그대로 JSON POST합니다.
"""

import json
import requests


class SlackTriggerExecutor:
    """Slack Webhook 트리거 실행기"""

    def execute(self, webhook_url: str, payload: dict) -> bool:
        """
        Slack Webhook으로 event_data를 직접 전송합니다.

        Args:
            webhook_url: Slack Webhook URL
            payload: event_data dict (고정 스키마 12개 key)

        Returns:
            성공 여부
        """
        try:
            print(f"Slack webhook payload: {json.dumps(payload, ensure_ascii=False)}")

            response = requests.post(
                webhook_url,
                json=payload,
                headers={'Content-Type': 'application/json'},
                timeout=5
            )

            if response.status_code in (200, 202):
                print(f"Slack webhook sent successfully: {response.status_code}")
                return True
            else:
                print(f"Slack webhook failed: {response.status_code} - {response.text}")
                return False

        except requests.Timeout:
            print("Slack webhook timeout")
            return False
        except requests.ConnectionError:
            print("Slack webhook connection error")
            return False
        except Exception as e:
            print(f"Slack webhook error: {str(e)}")
            return False
