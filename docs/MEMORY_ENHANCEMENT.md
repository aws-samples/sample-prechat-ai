# Bedrock Agent Memory Enhancement

## 개요

이 업데이트는 Amazon Bedrock Agent의 Memory 기능을 활성화하여 고객이 재접속할 때 대화 맥락을 유지할 수 있도록 합니다.

## 주요 변경사항

### 1. Agent 생성 시 Memory 자동 활성화
- 새로 생성되는 모든 Agent에 `SESSION_SUMMARY` 메모리 타입이 자동으로 활성화됩니다
- 메모리 보관 기간: 30일

### 2. 기존 Agent Memory 활성화 기능
- Admin Dashboard에서 "Memory 활성화" 버튼을 통해 기존 Agent들의 Memory를 활성화할 수 있습니다
- 기존 설정을 유지하면서 Memory 설정만 추가됩니다

### 3. 채팅 핸들러 개선
- 세션 연속성을 보장하기 위한 로깅 및 에러 처리 개선
- `endSession=False` 설정으로 세션 유지 보장

## 사용 방법

### 새 Agent 생성
새로 생성하는 Agent는 자동으로 Memory가 활성화됩니다.

### 기존 Agent Memory 활성화

#### Admin Dashboard 사용
1. Admin Dashboard → PreChat 에이전트 페이지 접속
2. 해당 Agent의 Actions 드롭다운에서 "Memory 활성화" 선택
3. 원하는 Memory Storage Days 설정 (1-365일)
4. Agent를 다시 준비(Prepare) 실행

## 기술적 세부사항

### Memory 설정
```python
memoryConfiguration={
    'enabledMemoryTypes': ['SESSION_SUMMARY'],
    'storageDays': 30
}
```

### 세션 연속성
- 동일한 `sessionId`를 사용하여 대화 맥락 유지
- `endSession=False` 설정으로 세션 활성 상태 유지
- 향상된 에러 처리 및 로깅

## 주의사항

1. **Agent 재준비 필요**: Memory 설정을 변경한 후에는 반드시 Agent를 다시 준비(Prepare)해야 합니다.

2. **메모리 보관 기간**: 현재 30일로 설정되어 있으며, 필요에 따라 조정 가능합니다.

3. **비용 고려**: Memory 기능 사용 시 추가 비용이 발생할 수 있습니다.

## 배포

변경사항을 적용하려면 다음 명령어를 실행하세요:

```bash
./deploy-full.sh
```

## 검증

Memory 기능이 정상적으로 작동하는지 확인하려면:

1. 고객 세션을 생성하고 몇 가지 대화를 나눕니다
2. 브라우저를 닫거나 세션을 종료합니다
3. 동일한 세션으로 다시 접속하여 이전 대화 맥락이 유지되는지 확인합니다

## 문제 해결

### Memory가 작동하지 않는 경우
1. Agent가 PREPARED 상태인지 확인
2. Memory 설정이 올바르게 적용되었는지 확인
3. 동일한 sessionId를 사용하고 있는지 확인

### 에러 로그 확인
CloudWatch Logs에서 다음 로그를 확인하세요:
- `ChatFunction` 로그
- `UpdateAgentFunction` 로그