"""
Trigger Manager

도메인 이벤트에 반응하여 등록된 트리거를 조회하고 실행하는 핵심 관리 클래스입니다.
event_data dict를 그대로 JSON payload로 전송합니다.
"""

import json
import boto3
import os
from typing import Optional

from models.trigger import Trigger, TriggerStatus

dynamodb = boto3.resource('dynamodb')
SESSIONS_TABLE = os.environ.get('SESSIONS_TABLE')


class TriggerManager:
    """Trigger 시스템의 핵심 관리 클래스"""

    def __init__(self):
        self.table = dynamodb.Table(SESSIONS_TABLE) if SESSIONS_TABLE else None
        self._executors = {}
        self._register_executors()

    def _register_executors(self):
        """트리거 유형별 실행기를 등록합니다."""
        from triggers.slack_trigger import SlackTriggerExecutor
        from triggers.sns_trigger import SNSTriggerExecutor

        self._executors['slack'] = SlackTriggerExecutor()
        self._executors['sns'] = SNSTriggerExecutor()

    def get_triggers_for_event(self, event_type: str, campaign_id: Optional[str] = None) -> list[Trigger]:
        """특정 이벤트 타입에 대한 활성 트리거를 조회합니다."""
        if not self.table:
            print("TriggerManager: No table configured")
            return []

        triggers = []

        try:
            resp = self.table.query(
                IndexName='GSI1',
                KeyConditionExpression='GSI1PK = :pk',
                ExpressionAttributeValues={':pk': f'EVENT#{event_type}'}
            )
            for item in resp.get('Items', []):
                trigger = Trigger.from_dynamodb_item(item)
                if trigger.status == TriggerStatus.ACTIVE.value:
                    if trigger.is_global or trigger.campaign_id == campaign_id:
                        triggers.append(trigger)
        except Exception as e:
            print(f"Error querying triggers for event {event_type}: {str(e)}")

        return triggers

    def execute_triggers(self, event_type: str, event_data: dict, campaign_id: Optional[str] = None):
        """이벤트에 대한 모든 활성 트리거를 실행합니다."""
        triggers = self.get_triggers_for_event(event_type, campaign_id)

        if not triggers:
            print(f"No active triggers for event {event_type}")
            return

        print(f"Executing {len(triggers)} triggers for event {event_type}")

        for trigger in triggers:
            try:
                self._execute_trigger(trigger, event_data)
            except Exception as e:
                print(f"Failed to execute trigger {trigger.trigger_id}: {str(e)}")

    def _execute_trigger(self, trigger: Trigger, event_data: dict) -> bool:
        """단일 트리거를 실행합니다. event_data를 그대로 JSON payload로 전송."""
        # 빈 문자열 필드를 "None"으로 치환
        payload = {k: (v if v != '' else 'None') for k, v in event_data.items()}

        print(f"Trigger {trigger.trigger_id} payload: {json.dumps(payload, ensure_ascii=False)}")

        executor = self._executors.get(trigger.trigger_type)
        if not executor:
            print(f"No executor for trigger type: {trigger.trigger_type}")
            return False

        success = executor.execute(trigger.delivery_endpoint, payload)
        if success:
            print(f"Trigger {trigger.trigger_id} ({trigger.trigger_type}) executed successfully")
        else:
            print(f"Trigger {trigger.trigger_id} ({trigger.trigger_type}) execution failed")

        return success
