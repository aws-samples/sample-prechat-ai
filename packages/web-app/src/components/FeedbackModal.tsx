// nosemgrep
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
import { useI18n } from '../i18n';

interface FeedbackModalProps {
  visible: boolean;
  onSubmit: (rating: number, feedback: string) => void;
  onDismiss?: () => void;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  visible,
  onSubmit,
  onDismiss
}) => {
  const { t } = useI18n();
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
      onDismiss={onDismiss}
      size="medium"
      header={
        <Header variant="h2">
          {t('customer.feedback.modalTitle')}
        </Header>
      }
      footer={
        <Box float="right">
          <Button 
            variant="primary" 
            onClick={handleSubmit}
            disabled={rating === 0}
          >
            {t('customer.feedback.submitButton')}
          </Button>
        </Box>
      }
      // No onDismiss prop to prevent closing with X button
    >
      <SpaceBetween size="l">
        <Box>
          <p>{t('customer.feedback.description')}</p>
        </Box>

        <FormField
          label={t('customer.feedback.ratingLabel')}
          description={t('customer.feedback.ratingDescription')}
        >
          <div className="star-rating">
            {renderStars()}
            {rating > 0 && (
              <span className="rating-text">
                {t('customer.feedback.ratingText', { rating: String(rating) })}
              </span>
            )}
          </div>
        </FormField>

        <FormField
          label={t('customer.feedback.additionalFeedbackLabel')}
          description={t('customer.feedback.additionalFeedbackDescription')}
        >
          <Textarea
            value={feedback}
            onChange={({ detail }) => setFeedback(detail.value)}
            placeholder={t('customer.feedback.feedbackPlaceholder')}
            rows={4}
          />
        </FormField>
      </SpaceBetween>
    </Modal>
  );
};
