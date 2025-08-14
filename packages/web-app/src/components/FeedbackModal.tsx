import React, { useState } from 'react';
import {
  Modal,
  Box,
  SpaceBetween,
  Button,
  Header,
  FormField,
  Textarea
} from '@cloudscape-design/components';

interface FeedbackModalProps {
  visible: boolean;
  onSubmit: (rating: number, feedback: string) => void;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  visible,
  onSubmit
}) => {
  const [rating, setRating] = useState<number>(0);
  const [feedback, setFeedback] = useState<string>('');
  const [hoveredRating, setHoveredRating] = useState<number>(0);

  const handleStarClick = (value: number) => {
    setRating(value);
  };

  const handleStarHover = (value: number) => {
    setHoveredRating(value);
  };

  const handleStarLeave = () => {
    setHoveredRating(0);
  };

  const handleSubmit = () => {
    if (rating > 0) {
      onSubmit(rating, feedback);
      // Reset form
      setRating(0);
      setFeedback('');
    }
  };

  const renderStars = () => {
    const stars = [];
    const displayRating = hoveredRating || rating;

    for (let i = 1; i <= 5; i++) {
      const fullStarValue = i;
      const halfStarValue = i - 0.5;
      
      // Determine fill state for this star
      let fillState = 'empty'; // empty, half, full
      if (displayRating >= fullStarValue) {
        fillState = 'full';
      } else if (displayRating >= halfStarValue) {
        fillState = 'half';
      }

      stars.push(
        <div
          key={i}
          className="star-wrapper"
          onMouseLeave={handleStarLeave}
        >
          {/* Background empty star */}
          <span className="star-bg">☆</span>
          
          {/* Filled star overlay */}
          <span 
            className={`star-fill ${fillState}`}
            style={{
              clipPath: fillState === 'half' ? 'inset(0 50% 0 0)' : 'none'
            }}
          >
            ★
          </span>
          
          {/* Invisible click areas */}
          <div
            className="star-click-area star-left-area"
            onClick={() => handleStarClick(halfStarValue)}
            onMouseEnter={() => handleStarHover(halfStarValue)}
          />
          <div
            className="star-click-area star-right-area"
            onClick={() => handleStarClick(fullStarValue)}
            onMouseEnter={() => handleStarHover(fullStarValue)}
          />
        </div>
      );
    }

    return stars;
  };

  return (
    <Modal
      visible={visible}
      size="medium"
      header={
        <Header variant="h2">
          사전상담 피드백
        </Header>
      }
      footer={
        <Box float="right">
          <Button 
            variant="primary" 
            onClick={handleSubmit}
            disabled={rating === 0}
          >
            전송
          </Button>
        </Box>
      }
      // No onDismiss prop to prevent closing with X button
    >
      <SpaceBetween size="l">
        <Box>
          <p>사전상담 경험은 어떠셨나요? 소중한 피드백을 남겨주세요.</p>
        </Box>

        <FormField
          label="사전상담 경험 점수"
          description="별을 클릭하여 점수를 선택해주세요 (0.5점 단위)"
        >
          <div className="star-rating">
            {renderStars()}
            {rating > 0 && (
              <span className="rating-text">
                {rating}점 / 5점
              </span>
            )}
          </div>
        </FormField>

        <FormField
          label="추가 피드백 (선택사항)"
          description="개선사항이나 좋았던 점을 자유롭게 작성해주세요"
        >
          <Textarea
            value={feedback}
            onChange={({ detail }) => setFeedback(detail.value)}
            placeholder="피드백을 입력해주세요..."
            rows={4}
          />
        </FormField>
      </SpaceBetween>
    </Modal>
  );
};