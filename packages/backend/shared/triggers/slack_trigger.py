"""
Slack Trigger Executor

Slack Workflow Webhook을 통해 메시지를 전송하는 트리거 실행기입니다.

Slack Workflow의 "웹후크에서(From a webhook)" 트리거는 플랫한 JSON key-value를
기대합니다. Workflow 내에서 각 데이터 변수를 메시지 블록에 매핑하여 사용합니다.

지원하는 Webhook URL 형식:
  - https://hooks.slack.com/triggers/...  (Workflow Builder webhook)
  - https://hooks.slack.com/services/...  (Incoming Webhook - legacy)
"""

import json
import requests


class SlackTriggerExecutor:
    """Slack Webhook 트리거 실행기"""

    def execute(self, webhook_url: str, message: str) -> bool:
        """
        Slack Webhook으로 메시지를 전송합니다.

        Slack Workflow Webhook은 플랫한 JSON을 기대하며,
        응답으로 HTTP 200 또는 202를 반환합니다.

        Args:
            webhook_url: Slack Webhook URL (Workflow 또는 Incoming)
            message: 렌더링된 메시지 (JSON 문자열)

        Returns:
            성공 여부
        """
        try:
            payload = self._build_payload(message)

            response = requests.post(
                webhook_url,
                json=payload,
                headers={'Content-Type': 'application/json'},
                timeout=5
            )

            # Slack Workflow webhook은 200 또는 202를 반환
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

    @staticmethod
    def _build_payload(message: str) -> dict:
        """
        렌더링된 메시지를 Slack 페이로드로 변환합니다.

        Slack Workflow Webhook은 플랫한 key-value JSON을 기대합니다:
        {
            "session_id": "...",
            "customer": "...",
            "sales_rep": "...",
            ...
        }
        """
        try:
            parsed = json.loads(message)
            if isinstance(parsed, dict):
                return parsed
        except (json.JSONDecodeError, TypeError):
            pass

        # JSON 파싱 실패 시 text 필드로 래핑 (Incoming Webhook 호환)
        return {"text": message}
