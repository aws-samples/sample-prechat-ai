import React, { useMemo } from 'react';
import Box from '@cloudscape-design/components/box';
import SpaceBetween from '@cloudscape-design/components/space-between';

export interface FormSubmissionSummaryProps {
  content: string; // JSON 직렬화된 폼 데이터
}

export const FormSubmissionSummary: React.FC<FormSubmissionSummaryProps> = ({ content }) => {
  const parsed = useMemo(() => {
    try {
      const data = JSON.parse(content);
      if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
        return data as Record<string, string>;
      }
      return null;
    } catch {
      return null;
    }
  }, [content]);

  if (!parsed) {
    return <Box>{content}</Box>;
  }

  const entries = Object.entries(parsed);

  if (entries.length === 0) {
    return <Box>{content}</Box>;
  }

  return (
    <SpaceBetween size="xs">
      <Box fontSize="body-s" color="text-status-inactive" fontWeight="bold">
        📋 제출된 정보
      </Box>
      {entries.map(([key, value]) => (
        <div key={key} style={{ display: 'flex', gap: '8px', fontSize: '14px' }}>
          <Box fontWeight="bold" display="inline" color="text-label">
            {key}:
          </Box>
          <Box display="inline">
            {String(value)}
          </Box>
        </div>
      ))}
    </SpaceBetween>
  );
};
