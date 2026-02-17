import React, { useRef, useEffect, useMemo } from 'react';
import DOMPurify, { type Config } from 'dompurify';
import Box from '@cloudscape-design/components/box';

export interface DivReturnRendererProps {
  htmlContent: string;
  onFormSubmit: (formData: Record<string, string>) => void;
  disabled?: boolean;
}

const SANITIZE_CONFIG: Config = {
  ALLOWED_TAGS: [
    'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'form', 'input', 'select', 'option', 'textarea', 'button', 'label',
    'br', 'hr', 'ul', 'ol', 'li', 'strong', 'em',
  ],
  ALLOWED_ATTR: [
    'class', 'id', 'name', 'type', 'value', 'placeholder',
    'required', 'for', 'disabled', 'selected',
  ],
  FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed'],
  FORBID_ATTR: ['onclick', 'onerror', 'onload', 'onmouseover', 'onfocus', 'onblur'],
};

// data-* 속성을 허용하기 위한 DOMPurify 훅 설정
function setupDataAttrHook() {
  DOMPurify.addHook('uponSanitizeAttribute', (_node, data) => {
    if (data.attrName && data.attrName.startsWith('data-')) {
      data.forceKeepAttr = true;
    }
  });
}

setupDataAttrHook();

const containerStyle: React.CSSProperties = {
  padding: '8px 0',
};

const formStyle = `
  .div-return-form input,
  .div-return-form select,
  .div-return-form textarea {
    display: block;
    width: 100%;
    padding: 8px 12px;
    margin: 4px 0 12px 0;
    border: 1px solid #aab7b8;
    border-radius: 4px;
    font-size: 14px;
    box-sizing: border-box;
  }
  .div-return-form textarea {
    min-height: 80px;
    resize: vertical;
  }
  .div-return-form label {
    display: block;
    font-weight: 600;
    margin-bottom: 4px;
    font-size: 14px;
    color: #16191f;
  }
  .div-return-form button[type="submit"],
  .div-return-form button:not([type]) {
    background-color: #0073bb;
    color: white;
    border: none;
    padding: 8px 20px;
    border-radius: 4px;
    font-size: 14px;
    cursor: pointer;
    margin-top: 8px;
  }
  .div-return-form button[type="submit"]:hover,
  .div-return-form button:not([type]):hover {
    background-color: #005a8e;
  }
  .div-return-form button:disabled,
  .div-return-form input:disabled,
  .div-return-form select:disabled,
  .div-return-form textarea:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

export const DivReturnRenderer: React.FC<DivReturnRendererProps> = ({
  htmlContent,
  onFormSubmit,
  disabled = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const sanitizedHTML = useMemo(
    () => DOMPurify.sanitize(htmlContent, SANITIZE_CONFIG),
    [htmlContent]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // disabled 상태 적용
    if (disabled) {
      const inputs = container.querySelectorAll('input, select, textarea, button');
      inputs.forEach((el) => el.setAttribute('disabled', 'true'));
    }

    // 폼 submit 이벤트 리스너
    const handleSubmit = (e: Event) => {
      e.preventDefault();
      const form = e.target as HTMLFormElement;
      const formData: Record<string, string> = {};
      const elements = form.elements;

      for (let i = 0; i < elements.length; i++) {
        const el = elements[i] as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
        if (el.name) {
          formData[el.name] = el.value;
        }
      }

      onFormSubmit(formData);
    };

    const forms = container.querySelectorAll('form');
    forms.forEach((form) => form.addEventListener('submit', handleSubmit));

    return () => {
      forms.forEach((form) => form.removeEventListener('submit', handleSubmit));
    };
  }, [sanitizedHTML, onFormSubmit, disabled]);

  if (!sanitizedHTML.trim()) {
    return (
      <Box color="text-status-inactive" fontSize="body-s">
        폼을 표시할 수 없습니다
      </Box>
    );
  }

  return (
    <div style={containerStyle}>
      <style>{formStyle}</style>
      <div
        ref={containerRef}
        className="div-return-form"
        dangerouslySetInnerHTML={{ __html: sanitizedHTML }}
      />
    </div>
  );
};
