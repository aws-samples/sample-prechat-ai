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
    return <Box color="inherit">{content}</Box>;
  }

  const entries = Object.entries(parsed);

  if (entries.length === 0) {
    return <Box color="inherit">{content}</Box>;
  }

  return (
    <SpaceBetween size="xs">
      <Box fontSize="body-s" color="inherit" fontWeight="bold">
        📋 제출된 정보
      </Box>
      {entries.map(([key, value]) => (
        <div key={key} style={{ display: 'flex', gap: '8px', fontSize: '14px', color: 'inherit' }}>
          <Box fontWeight="bold" display="inline" color="inherit">
            {key}:
          </Box>
          <Box display="inline" color="inherit">
            {String(value)}
          </Box>
        </div>
      ))}
    </SpaceBetween>
  );
};
