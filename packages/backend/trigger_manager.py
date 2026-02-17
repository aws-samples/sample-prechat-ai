"""
Trigger Manager

도메인 이벤트에 반응하여 등록된 트리거를 조회하고 실행하는 핵심 관리 클래스입니다.
Jinja2 템플릿 렌더링을 통해 메시지를 생성하고, 각 트리거 유형별 전송을 수행합니다.
"""

import json
import boto3
import os
from typing import Optional
from jinja2 import Template, TemplateSyntaxError

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

    def get_triggers_for_event(self, event_type: str, campaign_id: Optional[str] = None) -> list[dict]:
        """
        특정 이벤트 타입에 대한 활성 트리거를 조회합니다.

        1. 이벤트 타입별 전역 트리거 조회 (GSI1)
        2. 캠페인별 트리거 조회 (GSI2, campaign_id가 있는 경우)
        3. 비활성 트리거 필터링
        """
        if not self.table:
            print("TriggerManager: No table configured")
            return []

        triggers = []

        # 이벤트 타입별 트리거 조회 (GSI1)
        try:
            resp = self.table.query(
                IndexName='GSI1',
                KeyConditionExpression='GSI1PK = :pk',
                ExpressionAttributeValues={':pk': f'EVENT#{event_type}'}
            )
            for item in resp.get('Items', []):
                trigger = Trigger.from_dynamodb_item(item)
                if trigger.status == TriggerStatus.ACTIVE.value:
                    # 전역 트리거이거나 해당 캠페인의 트리거만 포함
                    if trigger.is_global or trigger.campaign_id == campaign_id:
                        triggers.append(trigger)
        except Exception as e:
            print(f"Error querying triggers for event {event_type}: {str(e)}")

        return triggers

    def execute_triggers(self, event_type: str, event_data: dict, campaign_id: Optional[str] = None):
        """
        이벤트에 대한 모든 활성 트리거를 실행합니다.
        개별 트리거 실패가 다른 트리거 실행에 영향을 주지 않습니다.
        """
        triggers = self.get_triggers_for_event(event_type, campaign_id)

        if not triggers:
            print(f"No active triggers for event {event_type}")
            return

        print(f"Executing {len(triggers)} triggers for event {event_type}")

        for trigger in triggers:
            try:
                self.execute_trigger(trigger, event_data)
            except Exception as e:
                # 개별 트리거 실패는 로깅만 하고 계속 진행
                print(f"Failed to execute trigger {trigger.trigger_id}: {str(e)}")

    def execute_trigger(self, trigger: Trigger, event_data: dict) -> bool:
        """단일 트리거를 실행합니다."""
        # 메시지 렌더링
        rendered_message = self.render_message(trigger.message_template, event_data)

        # 트리거 유형별 실행기 호출
        executor = self._executors.get(trigger.trigger_type)
        if not executor:
            print(f"No executor for trigger type: {trigger.trigger_type}")
            return False

        success = executor.execute(trigger.delivery_endpoint, rendered_message)
        if success:
            print(f"Trigger {trigger.trigger_id} ({trigger.trigger_type}) executed successfully")
        else:
            print(f"Trigger {trigger.trigger_id} ({trigger.trigger_type}) execution failed")

        return success

    @staticmethod
    def render_message(template_str: str, context: dict) -> str:
        """Jinja2 템플릿을 렌더링합니다."""
        try:
            template = Template(template_str)
            return template.render(**context)
        except TemplateSyntaxError as e:
            print(f"Template syntax error: {str(e)}")
            return template_str
        except Exception as e:
            print(f"Template rendering error: {str(e)}")
            return template_str

    @staticmethod
    def validate_template(template_str: str) -> tuple[bool, str]:
        """템플릿 문법을 검증합니다."""
        try:
            Template(template_str)
            return True, ''
        except TemplateSyntaxError as e:
            return False, f'Invalid template syntax: {str(e)}'
