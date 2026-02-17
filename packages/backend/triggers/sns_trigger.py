"""
SNS Trigger Executor

Amazon SNS Topic으로 메시지를 발행하는 트리거 실행기입니다.
"""

import json
import boto3


class SNSTriggerExecutor:
    """SNS Topic 트리거 실행기"""

    def __init__(self):
        self.sns = boto3.client('sns')

    def execute(self, topic_arn: str, message: str) -> bool:
        """
        SNS Topic에 메시지를 발행합니다.

        Args:
            topic_arn: SNS Topic ARN
            message: 발행할 메시지

        Returns:
            성공 여부
        """
        try:
            # 메시지에서 subject 추출 시도
            subject = self._extract_subject(message)

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

    @staticmethod
    def _extract_subject(message: str) -> str:
        """메시지에서 subject를 추출합니다."""
        try:
            parsed = json.loads(message)
            if isinstance(parsed, dict):
                # content.title 또는 subject 필드에서 추출
                content = parsed.get('content', {})
                if isinstance(content, dict):
                    title = content.get('title', '')
                    if title:
                        # SNS subject 최대 100자
                        return title[:100]
                return parsed.get('subject', 'PreChat Notification')[:100]
        except (json.JSONDecodeError, TypeError):
            pass

        return 'PreChat Notification'
