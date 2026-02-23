"""
SNS Trigger Executor

Amazon SNS Topic으로 event_data를 JSON 문자열로 발행합니다.
"""

import json
import boto3


class SNSTriggerExecutor:
    """SNS Topic 트리거 실행기"""

    def __init__(self):
        self.sns = boto3.client('sns')

    def execute(self, topic_arn: str, payload: dict) -> bool:
        """
        SNS Topic에 event_data를 발행합니다.

        Args:
            topic_arn: SNS Topic ARN
            payload: event_data dict

        Returns:
            성공 여부
        """
        try:
            message = json.dumps(payload, ensure_ascii=False)
            subject = f"PreChat {payload.get('event_type', 'Event')}"[:100]

            response = self.sns.publish(
                TopicArn=topic_arn,
                Message=message,
                Subject=subject
            )

            message_id = response.get('MessageId', '')
            print(f"SNS message published: {message_id} to {topic_arn}")
            return True

        except Exception as e:
            print(f"SNS publish error to {topic_arn}: {str(e)}")
            return False
